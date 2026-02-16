# GitHub Actions Setup

Este projeto ja possui automacao completa em GitHub Actions para:
- CI de testes Playwright por estagios
- Orquestracao de cards `Ready -> In progress -> In review`
- Agendamento automatico com loop por `workflow_run` + cron como backup
- Execucao sem necessidade de interagir no terminal

## Workflows existentes
- `.github/workflows/playwright.yml`
- `.github/workflows/project-ready-scheduler.yml`
- `.github/workflows/project-ready-orchestrator.yml`

Modelo de execucao do scheduler:
- `workflow_run` do orquestrador: mantem o loop automatico (com cooldown de 5 min)
- `schedule`: backup de resiliencia
- `push` em `main`: bootstrap automatico da esteira apos merge

## 1) Pre-requisitos
- `gh` autenticado com acesso ao repositorio
- Permissao para criar/editar secrets e variables do repo

## 2) Secrets obrigatorios
- `GH_PROJECT_TOKEN`
- `APP_USER_STANDARD_PASSWORD`
- `APP_USER_LOCKED_PASSWORD`
- `APP_USER_INVALID_PASSWORD`

Exemplo:
```bash
gh secret set GH_PROJECT_TOKEN --repo BrunoZanotta/autonomous-testing-ui
# repita para os outros secrets
```

## 3) Variables obrigatorias e opcionais
- `BASE_URL`
- `APP_USER_STANDARD_USERNAME`
- `APP_USER_LOCKED_USERNAME`
- `APP_USER_INVALID_USERNAME`

Variavel opcional:
- `PROJECT_READY_WORK_CMD`

Valor recomendado para `PROJECT_READY_WORK_CMD`:
```bash
node ./scripts/git/project-ready-work.mjs
```

Nao use valor `.sh` (ex.: `bash ./scripts/git/project-ready-work.sh`), pois e legado.

Exemplo:
```bash
gh variable set BASE_URL --body 'https://www.saucedemo.com' --repo BrunoZanotta/autonomous-testing-ui
gh variable set APP_USER_STANDARD_USERNAME --body 'standard_user' --repo BrunoZanotta/autonomous-testing-ui
gh variable set APP_USER_LOCKED_USERNAME --body 'locked_out_user' --repo BrunoZanotta/autonomous-testing-ui
gh variable set APP_USER_INVALID_USERNAME --body 'invalid_user' --repo BrunoZanotta/autonomous-testing-ui
gh variable set PROJECT_READY_WORK_CMD --body 'node ./scripts/git/project-ready-work.mjs' --repo BrunoZanotta/autonomous-testing-ui
```

## 4) Validar setup automaticamente
```bash
npm run actions:verify
```

Com JSON:
```bash
node ./scripts/git/verify-actions-setup.mjs --json
```

## 5) Testar execucao manual (opcional)
Rodar scheduler:
```bash
gh workflow run project-ready-scheduler.yml --repo BrunoZanotta/autonomous-testing-ui
```

Rodar orquestrador:
```bash
gh workflow run project-ready-orchestrator.yml --repo BrunoZanotta/autonomous-testing-ui
```

## 6) Regras para card ser processado
- Card precisa estar em `Ready`
- Label de tipo recomendada: `bug` ou `new test`
- Sem label de tipo, o fluxo infere o tipo pelo titulo/corpo e usa fallback `newTest`
- Se o texto do card for generico (sem pista de inventory/cart), o gerador cria um teste padrao de carrinho com dois produtos
- Priorizacao automatica: `bugfix` primeiro, depois `P0`, `P1`, `P2`

Se nao houver card elegivel, o workflow encerra sem erro.
