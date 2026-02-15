# 🤖 Autonomous Testing UI

![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen)
![Playwright](https://img.shields.io/badge/Playwright-1.56-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 🚀 Visão Geral

Este projeto demonstra o poder do **Playwright 1.56** com **agentes de IA integrados** combinado com as **melhores práticas de automação de testes**:

### 🤖 **Agentes de IA do Playwright**
- **QA Strategy Planner**: Analisa o site e gera um plano de testes em Markdown
- **QA Automation Generator**: Transforma o plano em código Playwright pronto para execução
- **QA Reliability Healer**: Executa os testes e corrige automaticamente falhas de seletor, timeout e visibilidade
- **QA Test Refactorer**: Refatora testes para manter padrao arquitetural, reduzir duplicacao e evitar flakiness
- **QA Governance Guardian**: Faz o gate final de qualidade, arquitetura e segurança para impedir quebra de regras
- **GitOps PR Orchestrator**: Cria branch, gera commit, faz push e abre PR no GitHub com guardrails
- **GitHub Project Ready PR Orchestrator**: Consome card em Ready, entrega testes e move card para In Review apos PR

### 🏗️ **Arquitetura Profissional**
- **Page Object Model (POM)**: Código organizado e reutilizável
- **Custom Fixtures**: Autenticação automática e Page Objects injetados
- **Execução em Stages**: CI/CD inteligente com retry e bloqueio
- **Sistema de Tags**: Organize e execute testes por categoria (@auth, @smoke, @regression)

Tudo **rodando localmente**, sem custo e sem depender de serviços externos.

---

## 📁 Estrutura do Projeto

```
autonomous-testing-ui/
├── pages/              # Page Objects (POM)
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   ├── CartPage.ts
│   └── CheckoutPage.ts
├── fixtures/           # Custom Fixtures
│   └── app.fixture.ts
├── tests/             # Testes organizados por módulo
│   ├── auth/         # @auth @smoke
│   ├── inventory/    # @inventory @regression
│   ├── cart/         # @cart @smoke @regression
│   └── checkout/     # @checkout @smoke
├── .github/
│   ├── agents/
│   │   └── playwright/
│   │       ├── qa-planner.agent.md
│   │       ├── qa-generator.agent.md
│   │       ├── qa-healer.agent.md
│   │       ├── qa-test-refactorer.agent.md
│   │       ├── qa-governance-guardian.agent.md
│   │       ├── gitops-pr-orchestrator.agent.md
│   │       └── github-project-ready-pr-orchestrator.agent.md
│   ├── workflows/
│   │   └── playwright.yml  # CI/CD em stages
└── playwright.config.ts
```

---

## 🧩 Requisitos

- Node.js 18 ou superior
- NPM 9+
- VS Code (opcional, para integração com MCP)
- Playwright 1.56.1 ou superior

---

## ⚙️ Instalação

```bash
git clone https://github.com/BrunoZanotta/autonomous-testing-ui.git
cd autonomous-testing-ui
npm ci
npx playwright install --with-deps
```

---

## 🧠 Ativando os Agentes de IA

Inicialize os agentes de IA do Playwright:

```bash
npx playwright init-agents --loop=vscode
```

Este repositório versiona os agentes em um padrão profissional em:

- `.github/agents/playwright/qa-planner.agent.md`
- `.github/agents/playwright/qa-generator.agent.md`
- `.github/agents/playwright/qa-healer.agent.md`
- `.github/agents/playwright/qa-test-refactorer.agent.md`
- `.github/agents/playwright/qa-governance-guardian.agent.md`
- `.github/agents/playwright/gitops-pr-orchestrator.agent.md`
- `.github/agents/playwright/github-project-ready-pr-orchestrator.agent.md`

Se quiser bootstrap automático do Playwright, você ainda pode usar:

- `.vscode/mcp.json`

---

## 🎭 Usando os Agentes

### 1️⃣ QA Strategy Planner – Gerar Plano de Testes

```bash
npx playwright agent planner --site=https://www.saucedemo.com --instructions="Plano POM: login, catálogo, carrinho, checkout."
```

**Output:** `plan.md` com plano detalhado de testes

### 2️⃣ QA Automation Generator – Criar os Testes

```bash
npx playwright agent generator --plan=plan.md
```

**Output:** Testes Playwright gerados automaticamente

### 3️⃣ QA Reliability Healer – Corrigir Testes com Falha

```bash
npx playwright agent healer
```

**Output:** Testes corrigidos automaticamente (seletores, timeouts, etc.)

### 4️⃣ QA Governance Guardian – Validar Regras no Final

Use este agent como etapa final para validar:
- exposição de dados sensíveis
- aderência a padrões de arquitetura
- prevenção de flakiness e waits proibidos

**Output:** Governance Gate Report com status PASS/FAIL e findings por severidade

### 5️⃣ GitOps PR Orchestrator – Branch, Commit e PR

Use este agent para automatizar entrega:
- criar branch padronizada
- gerar commit convencional
- fazer push para origin
- abrir PR no GitHub

Script de apoio:
```bash
./scripts/git/create-pr-flow.sh <branch> <commit-message> [base-branch] [pr-title] [pr-body-file]
```

### 6️⃣ QA Test Refactorer – Refatoracao Contínua

Use este agent quando houver necessidade de melhorar estrutura dos testes:
- remover duplicacao
- mover assertions e selectors para Page Objects
- reforcar padrao fixtures/pages/tests

### 7️⃣ GitHub Project Ready PR Orchestrator – Ready -> In Review

Pre-requisito de escopo no gh:
```bash
gh auth refresh -s read:project -s project
```

Use este agent para operacao automatizada via GitHub Project:
- buscar card em `Ready` no projeto `BrunoZanotta/3`
- criar branch e testes automatizados
- rodar testes e governance gate
- criar commit e abrir PR
- mover card para `In Review` apos criacao do PR

Scripts de apoio:
```bash
./scripts/git/project-ready-item.sh BrunoZanotta 3 BrunoZanotta/autonomous-testing-ui Ready
./scripts/git/project-ready-to-pr.sh BrunoZanotta 3 BrunoZanotta/autonomous-testing-ui main
./scripts/git/project-move-item.sh BrunoZanotta 3 <item_id> "In Review"
```

---

## 🧬 Executando os Testes

### Execução Local

```bash
# Todos os testes
npm test

# Apenas testes de autenticação
npm run test:auth

# Autenticação com 3 retries
npm run test:auth:retry

# Apenas smoke tests (críticos)
npm run test:smoke

# Apenas regression tests
npm run test:regression

# Por categoria
npm run test:inventory
npm run test:cart
npm run test:checkout
```

### Relatórios

```bash
# Abrir relatório HTML
npx playwright show-report
```

---

## 🎯 Estratégia de Testes - CI/CD em Stages

Este projeto implementa **execução em stages** no GitHub Actions com retry inteligente:

```
Stage 1: 🔐 Auth Tests (3 retries, BLOQUEANTE)
    ↓ (só continua se passar)
Stage 2: 💨 Smoke Tests (2 retries)
    ↓ (só continua se passar)
Stage 3: 🧪 Regression Tests (2 retries)
    ↓ (só continua se passar)
Stage 4: 🌐 Full Suite Multi-Browser (Chromium, Firefox, WebKit)
    ↓ (se falhar)
Stage 5: 🔧 Auto-Heal Snapshots (cria PR automaticamente)
```

### 🏷️ Tags Disponíveis

**Por Categoria:**
- `@auth` - Testes de autenticação
- `@inventory` - Testes de inventário
- `@cart` - Testes de carrinho
- `@checkout` - Testes de checkout

**Por Tipo:**
- `@smoke` - Testes críticos (devem sempre passar)
- `@regression` - Testes completos de regressão

### 💡 Benefícios da Abordagem

✅ **Feedback Ultra-Rápido:** Falhas de auth detectadas em ~10s
✅ **Economia de Recursos:** Pipeline para se crítico falhar (~70% economia)
✅ **Confiabilidade:** 3 retries em auth garantem que falhas são reais
✅ **Organização:** Testes agrupados logicamente por tags

📖 **Documentação completa:** [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

---

## 📊 Exemplo de Execução CI/CD

### ✅ Cenário: Tudo Passa

```
🔐 Auth Tests (3 retries)      ✅ PASSED  (~10s)
        ↓
💨 Smoke Tests (2 retries)      ✅ PASSED  (~20s)
        ↓
🧪 Regression Tests             ✅ PASSED  (~15s)
        ↓
🌐 Multi-Browser Suite          ✅ PASSED  (~30s)
        ↓
✅ PIPELINE SUCCESS             Total: ~75s
```

### ❌ Cenário: Auth Falha

```
🔐 Auth Tests
   Attempt 1: ❌ FAILED
   Attempt 2: ❌ FAILED
   Attempt 3: ❌ FAILED
        ↓
❌ PIPELINE STOPPED
   (Stages 2, 3, 4 NÃO executam)
        ↓
🔧 Auto-Heal Triggered
   Creates PR with fixes
```

---

## 🎨 Exemplos de Código

### Page Object Example

```typescript
// pages/LoginPage.ts
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[data-test="username"]');
    this.passwordInput = page.locator('[data-test="password"]');
    this.loginButton = page.locator('[data-test="login-button"]');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

### Teste com Fixtures e Tags

```typescript
import { test } from '../../fixtures/app.fixture';

test.describe('Authentication Tests', { tag: '@auth' }, () => {
  test('Successful Login', { tag: '@smoke' }, async ({ loginPage, inventoryPage }) => {
    await loginPage.goto();
    await loginPage.loginAsStandardUser();
    await loginPage.assertLoginSuccess();
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertShoppingCartLinkVisible();
  });
});
```

---

## 🛠️ Comandos Úteis

### Playwright CLI

```bash
# Executar com grep por tag
npx playwright test --grep @auth

# Executar excluindo uma tag
npx playwright test --grep-invert @smoke

# Executar combinando tags
npx playwright test --grep "@auth.*@smoke"

# Executar em browser específico
npx playwright test --grep @smoke --project=chromium

# Modo debug
npx playwright test --debug

# Modo UI interativo
npx playwright test --ui

# Gerar relatório
npx playwright show-report
```

---

## 🔍 Características do Projeto

### ✅ Page Object Model (POM)
- Separação clara entre lógica de página e testes
- Reutilização de código
- Fácil manutenção

### ✅ Custom Fixtures
- Login automático com `authenticatedPage`
- Page Objects injetados automaticamente
- Redução de 70% de código duplicado

### ✅ Centralização de Dados
- **LoginPage.ts**: URLs, usuários de teste e mensagens de autenticação
- **InventoryPage.ts**: catálogo de produtos e regras de ordenação
- **CheckoutPage.ts**: perfis de checkout e expectativas de resumo

### ✅ CI/CD Inteligente
- Execução em stages sequenciais
- Retry configurável por stage
- Auto-heal com PR automático
- Multi-browser paralelo

### ✅ Sistema de Tags
- Organização por categoria e tipo
- Execução seletiva de testes
- Fácil filtragem no CI/CD

---

## 📈 Melhorias Implementadas

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Código Duplicado** | Login em todos os testes | Fixture `authenticatedPage` |
| **Organização** | Testes na raiz | Pastas por módulo |
| **Seletores** | Hardcoded em cada teste | Centralizados em Page Objects |
| **Dados** | Strings hardcoded | Constantes centralizadas |
| **CI/CD** | Todos os testes sempre | Stages com bloqueio |
| **Browsers** | Apenas Chromium | 5 browsers/devices |
| **Feedback** | ~5min para tudo | ~10s para auth |
| **Manutenção** | Difícil | Fácil com POM |

---

## 🧪 Resultados dos Testes

```
✅ 2 testes @auth       (Authentication)
✅ 2 testes @inventory  (Product Listing & Sorting)
✅ 2 testes @cart       (Add & Management)
✅ 1 teste  @checkout   (Checkout Info)

Total: 8 passed em ~5s
```

---

## 🎓 Referências

- [📘 Documentação Playwright](https://playwright.dev/docs/intro)
- [🧩 Notas da versão 1.56](https://playwright.dev/docs/release-notes#version-156)
- [🏷️ Playwright Tags](https://playwright.dev/docs/test-annotations#tag-tests)
- [🤖 Playwright AI Agents](https://playwright.dev/docs/ai-agents)
- [⚙️ GitHub Actions](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs)

---

## 👨‍💻 Autor

Bruno Zanotta - QA Automation Specialist | AI | Quality Engineering - [LinkedIn](https://www.linkedin.com/in/bruno-zanotta-qa/)
