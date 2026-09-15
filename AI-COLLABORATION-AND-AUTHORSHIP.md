# AI Collaboration and Authorship Protocol

> **Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)
>
> **Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister. AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID.

## 1. Purpose

HiveStream may be developed with multiple LLMs working in parallel. This document establishes a provenance convention so that human collaborators and other LLMs can determine who produced a document, analysis, proposal, or revision.

The goal is collaboration, not competition.

Different LLMs may disagree, challenge assumptions, or identify weaknesses. Those disagreements should be preserved as useful engineering evidence rather than turned into competing or adversarial edits of one another's work.

## 2. Project author identity

This project uses a human-readable model name plus a unique project-local author ID.

### Current collaborator

- **Human:** William von Meister
- **AI model:** GPT-5.6 Luna
- **AI author ID:** `LUNA-HS-001`
- **Role:** AI Collaborator
- **Project:** HiveStream

The author ID is the important disambiguator when two collaborators use the same underlying model family or model version.

`LUNA-HS-001` identifies this collaborator's authorship within the HiveStream project. It must not be silently reused for a different AI collaborator instance.

If another GPT-5.6 Luna instance participates independently, it should receive a different author ID, for example `LUNA-HS-002`, rather than overwriting or impersonating `LUNA-HS-001`.

Likewise, a Claude collaborator should use its own project-local identity, for example `CLAUDE-HS-001`, if the project owner assigns that identifier.

## 3. Required attribution

Every new document created by an AI collaborator must identify:

1. William von Meister as Project Owner; and
2. the AI model name; and
3. the AI collaborator's unique project author ID.

Recommended header:

```text
Authorship: William von Meister (Project Owner) + GPT-5.6 Luna / LUNA-HS-001 (AI Collaborator)
```

A document should also contain the following provenance rule unless a more specific project convention replaces it:

```text
Authorship rule: This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID.
```

## 4. Existing documents

Documents previously authored by an AI collaborator should be retroactively identified with that collaborator's unique author ID when the authorship is known.

This metadata update is provenance maintenance, not a rewriting of the document's technical conclusions.

For documents whose authorship cannot be established reliably, do not invent an author. Mark the provenance as unknown or seek clarification from the project owner.

## 5. Do not overwrite another LLM's work merely to disagree

When one LLM encounters work produced by another LLM, the preferred pattern is:

```text
Existing work
      ↓
Independent analysis / critique
      ↓
Separate document
      ↓
Human/project-owner decision
      ↓
Explicit adopted revision, if desired
```

The default should be to preserve the original artifact and create a separate analysis document when the purpose is critique, comparison, or an alternative design.

An LLM may directly edit another document when the project owner explicitly requests a revision, when the edit is purely corrective/provenance-related, or when the project workflow has already designated that file as the canonical evolving document.

## 6. Productive disagreement

Disagreement between LLM collaborators is allowed and encouraged when it improves engineering quality.

Useful disagreement should:

- identify the specific claim being challenged;
- distinguish evidence from inference;
- explain the alternative interpretation;
- identify what experiment could resolve the disagreement;
- preserve the original author's contribution;
- avoid personal or adversarial framing.

The preferred language is therefore:

> "`LUNA-HS-001` proposes X. Independent review by `CLAUDE-HS-001` finds Y because evidence Z. The unresolved question is Q."

rather than rewriting X without attribution or presenting the disagreement as an argument between personalities.

## 7. Provenance of revisions

When a document is substantially revised, the revision should identify the contributor responsible for the revision.

For important documents, a provenance section may record:

| Revision | Contributor | Change type | Reason |
|---|---|---|---|
| ... | `LUNA-HS-001` | Draft / revision / correction | ... |
| ... | `CLAUDE-HS-001` | Independent critique | ... |
| ... | William von Meister | Project decision | ... |

This is especially useful when multiple LLMs work in parallel and later conclusions incorporate ideas from more than one collaborator.

## 8. Evidence hierarchy

Authorship does not make a technical claim true.

The project should distinguish:

1. observed evidence;
2. verified repository/code facts;
3. documented project decisions;
4. hypotheses;
5. proposals;
6. independent critiques.

An AI collaborator must not present another collaborator's hypothesis as established fact merely because it appears in a project document.

## 9. Canonical documents versus commentary

A canonical architecture document should contain adopted project decisions and stable definitions.

Independent critiques, alternative designs, experiments, and LLM-to-LLM reviews should normally live in separate documents.

This makes it possible for multiple collaborators to contribute competing hypotheses without destroying provenance.

The project owner decides when an independent proposal becomes part of the canonical architecture.

## 10. Identity is not authority

A unique author ID answers **who wrote this contribution**. It does not answer **who is correct**.

Technical authority should come from evidence, reproducible experiments, project-owner decisions, and explicit architectural adoption.

## 11. Non-goals

This protocol is not intended to:

- create an AI hierarchy;
- make one model inherently authoritative over another;
- prevent legitimate technical disagreement;
- force every discussion into a new document;
- obscure human ownership of the project.

Its purpose is simply to make collaborative reasoning traceable.

## 12. Collaboration principle

The desired multi-LLM workflow is:

```text
William von Meister
        │
        ├── GPT-5.6 Luna / LUNA-HS-001
        │          ↓
        │     proposal / implementation / analysis
        │
        ├── Other LLM collaborator
        │          ↓
        │     independent review / alternative / devil's advocate
        │
        └── Project decision
                   ↓
             canonical artifact
```

The objective is not for LLMs to "win" against one another. The objective is to use independent reasoning to make HiveStream more correct, more testable, and easier for future humans and LLMs to understand.
