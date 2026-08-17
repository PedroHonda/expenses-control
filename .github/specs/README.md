# `.github/specs/`

## Responsibility
Holds the Spec-Driven Development (SDD) contract files that drive implementation. Each spec is written and reviewed *before* the corresponding code is implemented.

## Naming convention
`XX_feature_name.spec.md`, numbered sequentially in the order features are specified (e.g. `01_api_contract.spec.md`).

## Contents
Empty as of Phase 0. The first spec (`01_api_contract.spec.md`, the backend/frontend API contract) is created in Phase 1.

## Why this approach
Following GitHub's Spec-Driven Development methodology: define the contract (endpoints, DTOs, error handling) formally and get it reviewed before writing implementation code, rather than letting the API shape emerge ad hoc from the code.
