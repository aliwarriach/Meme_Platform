"""create conversations and messages, migrate meme_sends into them

Revision ID: e1d2c3b4a596
Revises: 95e49a19db9a
Create Date: 2026-08-06 12:00:00.000000

Phase 19 replaces the flat `meme_sends` firehose with real conversations. The data move
is part of this migration rather than a follow-up script: `meme_sends` is dropped at the
end, so anything left behind is lost.

Mapping:
  - one conversation per distinct participant pair, participants stored canonically
    (smaller UUID in `user_a_id`) so both directions collapse to one row;
  - each send becomes a `meme`-kind message from the sender, `created_at` preserved so
    thread ordering matches what users already saw;
  - `status = 'seen'` becomes `read_at` (the send's `updated_at`, which is when the
    recipient's client acknowledged it);
  - a `reaction` becomes a short text message *from the recipient*, timestamped just
    after the meme it replied to — reactions were the only reply the old model allowed,
    and dropping them would silently delete the only conversation content that existed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e1d2c3b4a596'
down_revision: Union[str, Sequence[str], None] = '95e49a19db9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'conversations',
        sa.Column('user_a_id', sa.Uuid(), nullable=False),
        sa.Column('user_b_id', sa.Uuid(), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_a_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_b_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_a_id', 'user_b_id', name='uq_conversation_pair'),
    )
    op.create_index(op.f('ix_conversations_user_a_id'), 'conversations', ['user_a_id'], unique=False)
    op.create_index(op.f('ix_conversations_user_b_id'), 'conversations', ['user_b_id'], unique=False)
    op.create_index(
        op.f('ix_conversations_last_message_at'), 'conversations', ['last_message_at'], unique=False
    )

    op.create_table(
        'messages',
        sa.Column('conversation_id', sa.Uuid(), nullable=False),
        sa.Column('sender_id', sa.Uuid(), nullable=False),
        sa.Column('kind', sa.Enum('text', 'meme', name='message_kind'), nullable=False),
        sa.Column('body', sa.String(length=2000), nullable=True),
        sa.Column('meme_id', sa.Uuid(), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(
        'ix_messages_conversation_created', 'messages', ['conversation_id', 'created_at', 'id'], unique=False
    )

    _migrate_meme_sends()

    op.drop_index(op.f('ix_meme_sends_sender_id'), table_name='meme_sends')
    op.drop_index(op.f('ix_meme_sends_recipient_id'), table_name='meme_sends')
    op.drop_table('meme_sends')
    op.execute('DROP TYPE IF EXISTS meme_send_status')


def _migrate_meme_sends() -> None:
    bind = op.get_bind()

    # One conversation per distinct pair. LEAST/GREATEST on the text form gives the same
    # canonical ordering the application uses (`_canonical_pair` compares str(uuid)).
    bind.execute(
        sa.text(
            """
            INSERT INTO conversations (id, user_a_id, user_b_id, last_message_at, created_at, updated_at)
            SELECT
                gen_random_uuid(),
                LEAST(sender_id::text, recipient_id::text)::uuid,
                GREATEST(sender_id::text, recipient_id::text)::uuid,
                MAX(created_at),
                MIN(created_at),
                MAX(created_at)
            FROM meme_sends
            GROUP BY
                LEAST(sender_id::text, recipient_id::text),
                GREATEST(sender_id::text, recipient_id::text)
            """
        )
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO messages (
                id, conversation_id, sender_id, kind, body, meme_id, read_at, created_at, updated_at
            )
            SELECT
                s.id,
                c.id,
                s.sender_id,
                'meme',
                NULL,
                s.meme_id,
                CASE WHEN s.status = 'seen' THEN s.updated_at ELSE NULL END,
                s.created_at,
                s.updated_at
            FROM meme_sends s
            JOIN conversations c
              ON c.user_a_id = LEAST(s.sender_id::text, s.recipient_id::text)::uuid
             AND c.user_b_id = GREATEST(s.sender_id::text, s.recipient_id::text)::uuid
            """
        )
    )

    # Reactions become the recipient's reply, one second after the meme so the thread
    # orders correctly even where both rows share a timestamp.
    bind.execute(
        sa.text(
            """
            INSERT INTO messages (
                id, conversation_id, sender_id, kind, body, meme_id, read_at, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                c.id,
                s.recipient_id,
                'text',
                s.reaction,
                NULL,
                NULL,
                s.created_at + interval '1 second',
                s.updated_at
            FROM meme_sends s
            JOIN conversations c
              ON c.user_a_id = LEAST(s.sender_id::text, s.recipient_id::text)::uuid
             AND c.user_b_id = GREATEST(s.sender_id::text, s.recipient_id::text)::uuid
            WHERE s.reaction IS NOT NULL AND s.reaction <> ''
            """
        )
    )

    # A reaction can be newer than every meme in the pair's thread.
    bind.execute(
        sa.text(
            """
            UPDATE conversations c
            SET last_message_at = sub.newest
            FROM (
                SELECT conversation_id, MAX(created_at) AS newest FROM messages GROUP BY conversation_id
            ) sub
            WHERE sub.conversation_id = c.id
            """
        )
    )


def downgrade() -> None:
    """Downgrade schema.

    Recreates `meme_sends` and restores the meme messages. Text messages and read
    receipts have no representation in the old shape and are dropped — a reaction that
    round-tripped through the upgrade comes back as a reaction, but anything typed after
    Phase 19 shipped is genuinely unrepresentable here.
    """
    op.execute("CREATE TYPE meme_send_status AS ENUM ('delivered', 'pending', 'seen')")
    # create_type=False is load-bearing: a plain `sa.Enum` column makes `create_table`
    # emit its own CREATE TYPE, which collides with the one above.
    meme_send_status = postgresql.ENUM(
        'delivered', 'pending', 'seen', name='meme_send_status', create_type=False
    )

    op.create_table(
        'meme_sends',
        sa.Column('sender_id', sa.Uuid(), nullable=False),
        sa.Column('recipient_id', sa.Uuid(), nullable=False),
        sa.Column('meme_id', sa.Uuid(), nullable=False),
        sa.Column('status', meme_send_status, nullable=False),
        sa.Column('reaction', sa.String(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meme_id'], ['memes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_meme_sends_recipient_id'), 'meme_sends', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_meme_sends_sender_id'), 'meme_sends', ['sender_id'], unique=False)

    op.get_bind().execute(
        sa.text(
            """
            INSERT INTO meme_sends (
                id, sender_id, recipient_id, meme_id, status, reaction, created_at, updated_at
            )
            SELECT
                m.id,
                m.sender_id,
                CASE WHEN c.user_a_id = m.sender_id THEN c.user_b_id ELSE c.user_a_id END,
                m.meme_id,
                CASE WHEN m.read_at IS NOT NULL THEN 'seen' ELSE 'pending' END::meme_send_status,
                NULL,
                m.created_at,
                m.updated_at
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.kind = 'meme' AND m.meme_id IS NOT NULL
            """
        )
    )

    op.drop_index('ix_messages_conversation_created', table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_table('messages')
    op.execute('DROP TYPE IF EXISTS message_kind')

    op.drop_index(op.f('ix_conversations_last_message_at'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_user_b_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_user_a_id'), table_name='conversations')
    op.drop_table('conversations')
