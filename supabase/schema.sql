-- Sistema Cúmplice — Schema Supabase
-- Executa no SQL Editor do Supabase Dashboard

-- ============================
-- EXTENSÕES
-- ============================
create extension if not exists "uuid-ossp";

-- ============================
-- CLIENTES
-- ============================
create table clientes (
  id          uuid primary key default uuid_generate_v4(),
  razao_social text not null,
  cnpj        text not null unique,
  regime      text not null default 'Simples Nacional – Anexo I',
  setor       text,
  responsavel text,
  email       text,
  telefone    text,
  banco_principal text,
  limite_alerta_imposto numeric default 5.5,
  ativo       boolean default true,
  created_at  timestamptz default now()
);

-- ============================
-- USUÁRIOS ↔ CLIENTES (multi-tenant)
-- ============================
create table usuario_clientes (
  usuario_id  uuid references auth.users(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete cascade,
  papel       text default 'contador', -- contador | dono
  primary key (usuario_id, cliente_id)
);

-- ============================
-- COMPRAS
-- ============================
create table compras (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid references clientes(id) on delete cascade,
  periodo     text not null, -- YYYY-MM
  data        date not null,
  fornecedor  text not null,
  cnpj_fornecedor text,
  categoria   text,
  valor       numeric not null,
  nf_entrada  text, -- nulo = sem NF
  pagamento   text,
  status      text generated always as (
                case when nf_entrada is not null and nf_entrada <> '' then 'ok' else 'sem_nf' end
              ) stored,
  created_at  timestamptz default now()
);

-- ============================
-- NOTAS FISCAIS EMITIDAS
-- ============================
create table notas_fiscais (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid references clientes(id) on delete cascade,
  periodo     text not null,
  data        date not null,
  numero      text not null,
  chave_acesso text unique,
  cliente_nf  text,
  cfop        text,
  valor       numeric not null,
  recebimento text,
  data_recebimento date,
  conciliada  boolean default false,
  banco_lancamento_id uuid, -- preenchido após conciliação
  created_at  timestamptz default now()
);

-- ============================
-- MOVIMENTAÇÕES BANCÁRIAS
-- ============================
create table banco_lancamentos (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid references clientes(id) on delete cascade,
  periodo     text not null,
  data        date not null,
  descricao   text not null,
  categoria   text,
  tipo        text not null check (tipo in ('entrada','saida')),
  valor       numeric not null,
  nf_vinculada text,
  nota_fiscal_id uuid references notas_fiscais(id),
  status      text default 'pendente', -- ok | pendente | sem_nf | parcial
  conta       text,
  created_at  timestamptz default now()
);

-- ============================
-- DESPESAS OPERACIONAIS
-- ============================
create table despesas (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid references clientes(id) on delete cascade,
  periodo     text not null,
  data        date not null,
  descricao   text not null,
  categoria   text,
  valor       numeric not null,
  documento   text, -- nulo = sem comprovante
  pago_banco  boolean default true,
  dedutivel   text default 'sim', -- sim | parcial | nao
  status      text generated always as (
                case when documento is not null and documento <> '' then 'ok' else 'sem_doc' end
              ) stored,
  created_at  timestamptz default now()
);

-- ============================
-- DIVERGÊNCIAS (resultado do cruzamento)
-- ============================
create table divergencias (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid references clientes(id) on delete cascade,
  periodo     text not null,
  tipo        text not null, -- receita_nao_declarada | compra_sem_nf | despesa_sem_comprovante
  severidade  text not null, -- alto | medio | baixo
  valor       numeric,
  descricao   text,
  banco_lancamento_id uuid references banco_lancamentos(id),
  nota_fiscal_id uuid references notas_fiscais(id),
  compra_id   uuid references compras(id),
  despesa_id  uuid references despesas(id),
  resolvida   boolean default false,
  observacao  text,
  created_at  timestamptz default now()
);

-- ============================
-- THRESHOLDS POR CLIENTE
-- ============================
create table thresholds (
  cliente_id          uuid primary key references clientes(id) on delete cascade,
  divergencia_banco_nf numeric default 500,
  compra_sem_nf       numeric default 200,
  despesa_sem_doc     numeric default 300,
  sublimite_simples_pct numeric default 80
);

-- ============================
-- ROW LEVEL SECURITY
-- ============================
alter table clientes enable row level security;
alter table compras enable row level security;
alter table notas_fiscais enable row level security;
alter table banco_lancamentos enable row level security;
alter table despesas enable row level security;
alter table divergencias enable row level security;
alter table thresholds enable row level security;

-- Políticas: usuário só vê dados dos seus clientes
create policy "clientes_acesso" on clientes
  using (id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "compras_acesso" on compras
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "notas_fiscais_acesso" on notas_fiscais
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "banco_lancamentos_acesso" on banco_lancamentos
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "despesas_acesso" on despesas
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "divergencias_acesso" on divergencias
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

create policy "thresholds_acesso" on thresholds
  using (cliente_id in (
    select cliente_id from usuario_clientes where usuario_id = auth.uid()
  ));

-- ============================
-- DADOS DE EXEMPLO
-- ============================
-- (inserir após criar usuário via auth)
