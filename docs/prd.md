# Product Requirements Document: ReviewFlow

## 1. Vision
To seamlessly bridge the gap between local development and code review by providing an IDE-native workspace where human intuition and AI assistance collaborate to produce high-quality, thoughtful review feedback.

## 2. Problem Statement
Context-switching between the IDE (where code is analyzed and understood) and a web browser (where code reviews are conducted) disrupts developer flow, leading to lower quality reviews and increased time-to-merge. Additionally, existing AI review tools often attempt to replace the reviewer, resulting in unhelpful automation, hallucinations, and a loss of human oversight. Developers need a way to draft, organize, and refine review comments natively within their editor before publishing them to their version control system.

## 3. Goals
- Provide an IDE-native (Cursor) code review workspace for drafting and organizing review comments.
- Ensure all draft comments are stored securely on the local machine until explicitly published.
- Leverage AI as a helpful assistant to suggest draft comments, not as an autonomous reviewer.
- Enable seamless publishing of batch review comments to GitLab.
- Support multi-repository workflows gracefully.
- Architect an enterprise-ready system with a Python backend and Cursor extension frontend.

## 4. Non-goals
- Auto-resolving threads or modifying source code directly based on review comments.
- Fully autonomous AI reviews (AI will never publish directly).
- Replacing the source of truth (GitLab remains the system of record for the final review).
- GitHub support in the MVP phase (slated for future scope).

## 5. Personas
- **The Senior/Lead Engineer:** Conducts multiple code reviews daily. Needs to quickly navigate complex diffs, draft multiple thoughts across different files, and organize them before publishing a cohesive review.
- **The Mid-Level Engineer:** Seeks to provide thorough reviews and occasionally uses AI assistance to help articulate potential issues, edge cases, or architectural concerns.
- **The Security/Enterprise User:** Requires strict data privacy, ensuring draft reviews and proprietary code context are not leaked, with safe AI usage policies.

## 6. User Stories
- As a reviewer, I want to add a draft comment directly on a line of code in my IDE so that I don't have to switch to my browser.
- As a reviewer, I want my draft comments saved locally so that I don't lose my work if I close the IDE or restart my machine.
- As a reviewer, I want AI to suggest a draft comment for a highlighted block of code to help me quickly articulate a concern.
- As a reviewer, I want to review all my drafts in a centralized IDE panel before clicking "Publish" to GitLab.
- As an engineer working across microservices, I want ReviewFlow to support multiple repositories seamlessly so I can review related Merge Requests efficiently.

## 7. Functional Requirements
- **Local Workspace:** Ability to create, read, update, and delete (CRUD) draft comments on specific files and line numbers within the IDE.
- **State Management:** Local database/storage (e.g., SQLite or local filesystem) to persist drafts per repository and Merge Request.
- **GitLab Integration:** 
  - Authenticate securely via GitLab Personal Access Token (PAT) or OAuth.
  - Fetch open Merge Requests (MRs) and their diffs for the current repository.
  - Publish all locally drafted comments to the corresponding GitLab MR in a single batch.
- **AI Assistant:** 
  - Generate draft comment suggestions based on code diffs and human prompts.
  - Explicit "Accept/Edit/Reject" interface for AI suggestions.
- **Extension UI:** A dedicated panel in Cursor to view all pending drafts for the current MR.

## 8. Non-functional Requirements
- **Performance:** AI draft suggestion generation must return within 3 seconds. The local draft UI must have zero perceptible latency (<100ms).
- **Security:** API keys and access tokens must be stored securely using the OS keychain. Review drafts must not be sent to any external server other than the authorized AI provider and GitLab.
- **Reliability:** The Python backend must handle network disconnects gracefully, keeping drafts safe locally if publishing fails.
- **Enterprise-readiness:** Architecture must support on-premise deployment of the backend and compatibility with self-hosted GitLab instances.

## 9. Success Metrics
- **Adoption:** Number of Active Users (DAU/WAU) installing and authenticating the extension.
- **Engagement:** Number of draft comments created natively in the IDE vs. direct browser comments.
- **Efficiency:** Reduction in average time-to-publish for code reviews.
- **Quality:** High acceptance rate of AI-suggested draft comments (aiming for >70% retained or lightly edited).

## 10. Risks
- **GitLab API Limitations:** Rate limits or changes in the GitLab API could impact comment publishing. *Mitigation: Implement robust retry logic and batching.*
- **AI Hallucinations:** AI might suggest irrelevant or incorrect comments. *Mitigation: Strict adherence to the "human-first" principle; AI output is strictly marked as a draft requiring explicit approval.*
- **Cursor Extension API Constraints:** VS Code / Cursor extension API limits on inline commenting UI. *Mitigation: Prototype the VS Code `CommentController` API early in the MVP phase to ensure technical feasibility.*

## 11. MVP Scope
- Cursor extension frontend using VS Code Commenting API.
- Python backend (local or cloud-hosted) for handling AI integrations and business logic.
- Local SQLite or JSON-based persistence for draft comments.
- GitLab integration (fetch MRs, publish draft comments to MR).
- Basic AI assistant for generating single-comment drafts on highlighted code.
- Support for a single configured GitLab instance (Cloud or Self-hosted).

## 12. Future Scope
- **GitHub Integration:** Full support for GitHub Pull Requests.
- **Review Templates:** Pre-defined checklists or review guidelines configured per repository.
- **Advanced AI:** Multi-file AI context for architectural review suggestions.
- **Team Analytics:** Insights into review turnaround times and helpfulness.
- **Thread Management:** Replying to and resolving existing comments directly from the IDE.