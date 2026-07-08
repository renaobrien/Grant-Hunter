Label/value row for detail and settings views. 160px label column + value column, hairline divider, stacks under 900px.

```jsx
<FieldRow label="Recommendation"><Chip label="Pursue" tone="good" /></FieldRow>
<FieldRow label="Confidence">high</FieldRow>
```

Convention: render nothing when the value is empty rather than showing a blank row.
