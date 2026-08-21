from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def score_text(text: str) -> tuple[float, str]:
    if not text:
        return 0.0, "neutral"
    s = _analyzer.polarity_scores(text)["compound"]
    if s >= 0.05:
        label = "positive"
    elif s <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    return float(s), label
