A Chip that maps a grant status to its canonical tone + label. Use anywhere a grant's status is shown.

```jsx
<StatusChip status="researching" />  {/* → info "Researching" */}
<StatusChip status="awarded" />      {/* → good "Awarded" */}
```

Statuses: found, researching, drafting, applied, submitted, awarded, passed, discarded, dead.
