# Goals

Your task is to build a minimum viable product, but functional Learning Management System for an MOS course. Components include a functional backend
& user-friendly frontend (UI/UX).

# Platforms

The app should be able to run on browsers of both phones and PC

# Agent Rules

## Workflows
1. Inspect code & only relevant docs.
2. Do not assume/guess anything. If any required information is missing, a question of multiple choices, including an option to
write the user's own choice, must be presented and asked before performing the task
3. For most tasks, your workflow will be: planning -> implementing -> testing -> final review/handover
4. Use relavant installed skills, tools & sub-agents if available. Select appropriate models for each type of task. Switch model/retry
at least 2 and at most 4 times if the agent couldn't be called (because of any reason, including, but not limited to, model failure due to out-of-quota)
5. Generate tests with all possible cases & edge cases. Only mark a task as completed when tests are passed
6. Strictly keep secrets protected on backend's environment variables. Do not expose them to any logs, user-viewable codes and Git
7. Record significant choices back to docs/DECISIONS.md. Keep it clean, organized & short to reduce token usage
8. No production requests, destructive changes or deployment without approval

## Saving docs
Generated instructions for agents, feature documentations, failure reports & current progress are saved into docs/
Keep the folder clean & structured with proper labels

## File structure
Keep the project structure organized. Modularize instead of stuffing everything into 1 file. 
Separate backend & frontend into separate folders
Keep code readability high

## Limitations
- Strict hardware limitations & budget. Only 1vCPU/~1-2GB RAM is provisioned. Implement rate-limiting, security features & optimization carefully
- Make use of 3rd-party free/cheap services whenever possible.
- At peak time, rates can spike up to ~200 concurrent requests/sec.
- For a LMS, data integrity is top-priority. Slower responses can be allowed to a degree, but data must be kept correct

## Tech stack
You can choose any tech stack, for backend & frontend, that should be:
- Widely supported by multiple platforms (PC/Phones) without too much code divergent
- Have reliable performance on such limited hardware.

## Frontend text & content language
- Vietnamese