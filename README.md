# BTC Cent Forecast — make.fun btc-cent-forecast-01

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![rank](https://make.fun/badge/btc-cent-forecast-01/Riaking89/btc-cent-forecast-ria/rank.svg)](https://make.fun/bounty/btc-cent-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![reward](https://make.fun/badge/btc-cent-forecast-01/Riaking89/btc-cent-forecast-ria/reward.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

Entry for [make.fun/bounty/btc-cent-forecast-01](https://make.fun/bounty/btc-cent-forecast-01):
forecast Bitcoin's US-dollar price 240 minutes after each checkpoint, from
the 4,320 one-minute closes of the 72 hours up to it.

`main.ts` (Node 22, standard library only) forecasts with a damped trend:
last close moved by half the recency-weighted drift of the last 1h/4h/12h,
pulled slightly back toward the 24h mean, and capped at one realised
4-hour volatility — never plain persistence. No network, no randomness, no
clock: two runs on the same case write identical bytes.

Practice check (answers read off the overlapping practice inputs): mean
absolute error about 40,700 cents on p00–p04, against persistence's 47,100
— roughly 14% better than the house baseline.
