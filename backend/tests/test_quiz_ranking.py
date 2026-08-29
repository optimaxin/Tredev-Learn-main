"""Pure unit test for the quiz leaderboard ranking rule: highest score first,
then fastest completion time, no live server or DB required."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server import rank_leaderboard


def test_rank_leaderboard_orders_by_score_then_time():
    rows = [
        {"attempt_id": "slow_winner", "total_score": 90, "time_taken_seconds": 300},
        {"attempt_id": "fast_winner", "total_score": 90, "time_taken_seconds": 120},
        {"attempt_id": "low_score", "total_score": 40, "time_taken_seconds": 60},
        {"attempt_id": "no_time", "total_score": 90, "time_taken_seconds": None},
    ]
    ranked = rank_leaderboard(rows)
    assert [r["attempt_id"] for r in ranked] == ["fast_winner", "slow_winner", "no_time", "low_score"]
    assert [r["rank"] for r in ranked] == [1, 2, 3, 4]


if __name__ == "__main__":
    test_rank_leaderboard_orders_by_score_then_time()
    print("ok")
