import enum


class CompetitionPeriod(str, enum.Enum):
    day = "day"
    week = "week"
    month = "month"
