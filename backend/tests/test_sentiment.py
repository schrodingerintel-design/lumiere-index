"""Tests for sentiment analysis service."""
from app.services.sentiment import score_text


def test_score_text_positive():
    score, label = score_text("This movie is absolutely amazing and incredible!")
    assert label == "positive"
    assert score > 0.05


def test_score_text_negative():
    score, label = score_text("This is the worst film I have ever seen. Terrible.")
    assert label == "negative"
    assert score < -0.05


def test_score_text_neutral():
    score, label = score_text("The film was released in theaters on Friday.")
    assert label == "neutral"
    assert -0.05 <= score <= 0.05


def test_score_text_empty():
    score, label = score_text("")
    assert label == "neutral"
    assert score == 0.0


def test_score_text_boundary_positive():
    score, label = score_text("Good movie")
    assert label == "positive"
    assert score >= 0.05


def test_score_text_boundary_negative():
    score, label = score_text("Bad movie, waste of time")
    assert label == "negative"
    assert score <= -0.05


def test_score_text_strong_positive():
    score, label = score_text("Masterpiece! Best film of the decade, absolute perfection!")
    assert label == "positive"
    assert score > 0.5


def test_score_text_strong_negative():
    score, label = score_text("Absolute garbage. Disaster. Worst thing ever made.")
    assert label == "negative"
    assert score < -0.5
