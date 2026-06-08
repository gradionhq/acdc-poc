# Task B — Fix the pagination bug

A user reports: "Listing notes with `?page=1` skips the first notes — the first
page seems to be missing and results start from the second page."

Find and fix the bug so that page 1 returns the first `pageSize` notes, page 2
the next `pageSize`, and so on (1-based paging). Add a regression test.

Follow `CLAUDE.md`. Do not change unrelated code.
