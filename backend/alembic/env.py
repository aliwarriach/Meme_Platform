import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Standard Alembic template structure: these must come after fileConfig() above sets up
# logging, so they stay below it despite E402.
from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402, F401  (registers all models on Base.metadata)

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", settings.database_url)

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # See do_run_migrations() below for why this is required.
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    # transaction_per_migration=True: without it, Alembic wraps every revision applied in
    # a single `alembic upgrade head` invocation into ONE outer transaction. Postgres
    # forbids using a brand-new enum value (`ALTER TYPE ... ADD VALUE`) until the
    # transaction that added it has committed — so a later revision in the same run that
    # *uses* a value a previous revision just added (see 9b1d4e6a2f53 -> c47a1b2e9f60)
    # fails with "unsafe use of new value ... New enum values must be committed before
    # they can be used". Committing per-revision (this setting) is the standard Alembic
    # fix and is what makes a single `alembic upgrade head` from an empty database safe —
    # required for A6/A7's Docker image and B3's real RDS migration, neither of which can
    # rely on a hand-run two-step workaround.
    context.configure(
        connection=connection, target_metadata=target_metadata, transaction_per_migration=True
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
