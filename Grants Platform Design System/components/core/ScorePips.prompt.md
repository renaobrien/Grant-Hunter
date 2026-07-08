Compact 1–5 filled/empty pip meter for grant scores (Fit, Alignment/Ethos, human rating).

```jsx
<ScorePips score={4} />        {/* 4 filled, 1 empty */}
<ScorePips score={null} />     {/* em-dash placeholder */}
```

`max` defaults to 5. Filled pips use `--brand-primary`. Pair with a numeric readout (`<ScorePips score={s} /> {s} / 5`) on detail views.
