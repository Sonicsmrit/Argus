# Argus Adverse Media Pipeline Guidelines

This project leverages Bright Data's **Scraper Studio** to manage Custom AI Collectors for adverse media tracking.

## 📌 Configured Collector IDs
Always use these pre-built production APIs instead of creating new ones:

```javascript
const COLLECTORS = {
  aljazeera: 'c_mt0s3rbf1xzxyyduqz',
  balkaninsight: 'c_mt0s6sdg7gm0v9y04',
  dailymaverick: 'c_mt0s530w9ffw3kedm',
  insightcrime: 'c_mt0s5vrz11suwz02n2',
  moscowtimes: 'c_mt0s6bveu3sh7c7i8',
  occrp: 'c_mt0s4o1e1met6dsy3z',
  rappler: 'c_mt0s760b1colkre4l1',
  middleeasteye: 'c_mt0sjczi1xlj5a2mvx'
};
```

## 🛠️ CLI Operations Reference
- **Run Collector:** `npx -p @brightdata/cli bdata scraper run <collector_id> "<url>" --pretty -o output.json`
- **Heal Layout Drift:** `npx -p @brightdata/cli bdata scraper heal <collector_id> "<prompt describing what changed or broke>"`
