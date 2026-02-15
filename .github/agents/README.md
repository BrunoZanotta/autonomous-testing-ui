# Agents Catalog

Este diretório centraliza os agentes versionados do projeto.

## Estrutura

- `playwright/qa-planner.agent.md`
- `playwright/qa-generator.agent.md`
- `playwright/qa-healer.agent.md`
- `playwright/qa-test-refactorer.agent.md`
- `playwright/qa-governance-guardian.agent.md`
- `playwright/gitops-pr-orchestrator.agent.md`
- `playwright/github-project-ready-pr-orchestrator.agent.md`

## Convenção de Nomes

- Formato: `<dominio>-<capacidade>-<papel>.agent.md`
- Objetivo: facilitar descoberta, governança e evolução dos agentes.
- Exemplo adotado:
  - `qa-planner`
  - `qa-generator`
  - `qa-healer`
  - `qa-test-refactorer`
  - `qa-governance-guardian`
  - `gitops-pr-orchestrator`
  - `github-project-ready-pr-orchestrator`

## Regra de Organização

- Cada arquivo define um agente com escopo claro.
- Agentes devem manter instruções orientadas a arquitetura em camadas:
  - `fixtures` para setup/injeção
  - `pages` para ações, assertions e dados de domínio
  - `tests` para steps/orquestração
- O `qa-governance-guardian` deve ser executado no fim do fluxo como gate final.
- O `gitops-pr-orchestrator` deve ser executado para entrega de código: branch, commit, push e PR.
- O `github-project-ready-pr-orchestrator` opera cards `Ready` do Project v2 e move para `In Review` após PR.
