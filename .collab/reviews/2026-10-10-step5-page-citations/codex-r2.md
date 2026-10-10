VERDICT: SHIP

No findings. The checked blog fixes no longer overclaim, and the counts are consistent. `fetch()` now converts `URLError`/`TimeoutError` to status `0` so `validate()` stops before send, and `submit()` reports network failure with return code `3`.