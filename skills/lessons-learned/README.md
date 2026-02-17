Suggest to also add this to your Claude Code settings.json:

```
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Context compaction imminent. Run /lessons-learned now to persist any generally applicable lessons before detailed context is lost.'"
          }
        ]
      }
    ],
```

and this to CLAUDE.md : 

```
- **Call `/lessons-learned` proactively.** Whenever something goes wrong or you encounter friction (rejected plans, failed tasks, corrective user feedback), use this skill to update this file, your memories and/or your skills. 
```
