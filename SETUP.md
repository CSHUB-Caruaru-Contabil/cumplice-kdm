# Sistema Cúmplice — Setup

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (auth + PostgreSQL)
- Tailwind CSS

---

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com e crie um projeto
2. Copie a URL e a Anon Key em **Settings > API**
3. Abra **SQL Editor** e execute o conteúdo de `supabase/schema.sql`

---

## 2. Configurar variáveis de ambiente

Edite o arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

---

## 3. Criar usuário contador

No Supabase Dashboard > **Authentication > Users > Invite user**, crie o primeiro usuário.

---

## 4. Cadastrar primeiro cliente

Após fazer login, rode no SQL Editor do Supabase:

```sql
-- 1. Inserir cliente
insert into clientes (razao_social, cnpj, regime, setor, responsavel, email, telefone)
values ('Mercado São Lucas Ltda', '12.345.678/0001-99', 'Simples Nacional – Anexo I',
        'Comércio – Mercado/Supermercado', 'Lucas Ferreira', 'lucas@email.com', '(11) 99888-7766');

-- 2. Vincular ao usuário (substitua os IDs reais)
insert into usuario_clientes (usuario_id, cliente_id, papel)
values (
  (select id from auth.users where email = 'SEU-EMAIL@dominio.com'),
  (select id from clientes where cnpj = '12.345.678/0001-99'),
  'contador'
);

-- 3. Inserir thresholds padrão
insert into thresholds (cliente_id)
values ((select id from clientes where cnpj = '12.345.678/0001-99'));
```

---

## 5. Rodar localmente

```bash
cd cumplice
npm install
npm run dev
```

Acesse: http://localhost:3000

---

## Arquitetura

```
src/
  app/
    page.tsx              → Redireciona para /dashboard ou /login
    login/page.tsx        → Tela de login
    dashboard/
      page.tsx            → Server component (busca clientes)
      DashboardClient.tsx → Shell do dashboard (client)
    api/
      clientes/[id]/
        kpis/route.ts     → GET KPIs + cruzamento
        importar-nfe/     → POST upload XML NF-e
        importar-banco/   → POST upload OFX/CSV
  lib/
    supabase/             → client.ts, server.ts, types.ts
    parsers/
      nfe.ts              → Parser XML NF-e completo
      ofx.ts              → Parser OFX 1.x e 2.x
      csv.ts              → Parser CSV multi-formato (Itaú, Bradesco, Nubank, genérico)
    crossref.ts           → Motor de cruzamento NF × Banco (±2% valor, ±3 dias)
  components/
    Sidebar.tsx
    ui.tsx                → Componentes: Card, Table, Badge, Toast, UploadZone...
    sections/
      VisaoGeral.tsx      → KPIs + cruzamento rápido + saúde financeira
      Compras.tsx         → CRUD + import XML
      NotasFiscais.tsx    → CRUD + import XML
      Banco.tsx           → CRUD + import OFX/CSV
      Despesas.tsx        → CRUD
      Cruzamento.tsx      → Divergências automáticas
      Projecao.tsx        → Simples × Presumido + Fator R
      Config.tsx          → Perfil + thresholds
  middleware.ts           → Proteção de rotas com Supabase SSR
supabase/
  schema.sql              → Schema completo com RLS multi-tenant
```

---

## Fluxo de cruzamento

O motor em `src/lib/crossref.ts` executa no browser (dados já carregados):

1. **Entradas banco × NFs emitidas** — match por valor ±2% e data ±3 dias
2. **Compras sem NF de entrada** — filtra `status = 'sem_nf'`  
3. **Despesas sem comprovante** — filtra `status = 'sem_doc'`

Divergências são classificadas por severidade: `alto` | `medio` | `baixo`.

---

## Próximos passos

- [ ] Exportação de relatório PDF
- [ ] Gráficos históricos (recharts já instalado)
- [ ] Notificações por e-mail (Supabase Edge Functions)
- [ ] Integração SEFAZ para consulta de NF-e
- [ ] Dashboard multi-período (comparativo meses)
