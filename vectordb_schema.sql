--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg120+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: update_document_processing_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_document_processing_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update document processing flags when embeddings are created
    IF TG_OP = 'INSERT' THEN
        UPDATE documents 
        SET embeddings_created = TRUE,
            text_chunks_count = (
                SELECT COUNT(*) FROM embeddings WHERE document_id = NEW.document_id
            ),
            processing_status = CASE 
                WHEN processing_status = 'embedding' THEN 'completed'
                ELSE processing_status 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.document_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.update_document_processing_status() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_name character varying(255) NOT NULL,
    deal_name character varying(255),
    deal_description text,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    CONSTRAINT deals_company_name_check CHECK ((length((company_name)::text) > 0)),
    CONSTRAINT deals_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    deal_id uuid NOT NULL,
    file_name character varying(500) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size bigint,
    mime_type character varying(255),
    file_extension character varying(20),
    file_data bytea,
    file_path text,
    processing_status character varying(50) DEFAULT 'uploaded'::character varying,
    processing_error text,
    converted_formats text[],
    text_extracted boolean DEFAULT false,
    embeddings_created boolean DEFAULT false,
    extracted_text text,
    text_chunks_count integer DEFAULT 0,
    google_doc_id character varying(255),
    converted_pdf_url text,
    converted_text_url text,
    image_description text,
    image_width integer,
    image_height integer,
    gemini_processing_tokens integer,
    n8n_execution_id character varying(100),
    workflow_step_completed character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    CONSTRAINT documents_file_size_check CHECK ((file_size >= 0)),
    CONSTRAINT documents_processing_status_check CHECK (((processing_status)::text = ANY ((ARRAY['uploaded'::character varying, 'processing'::character varying, 'converting'::character varying, 'extracting'::character varying, 'embedding'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.embeddings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    deal_id uuid NOT NULL,
    document_id uuid NOT NULL,
    content text NOT NULL,
    content_hash character varying(64),
    embedding public.vector(1536) NOT NULL,
    company_name character varying(255) NOT NULL,
    file_name character varying(500) NOT NULL,
    file_type character varying(100) NOT NULL,
    chunk_index integer DEFAULT 0 NOT NULL,
    chunk_size integer,
    chunk_overlap integer DEFAULT 0,
    content_type character varying(100) DEFAULT 'text'::character varying,
    page_number integer,
    section_title character varying(500),
    embedding_model character varying(100) DEFAULT 'text-embedding-3-small'::character varying NOT NULL,
    embedding_dimensions integer DEFAULT 1536 NOT NULL,
    openai_tokens_used integer,
    openai_request_id character varying(100),
    content_quality_score numeric(3,2),
    semantic_density numeric(3,2),
    n8n_execution_id character varying(100),
    processing_duration_ms integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.embeddings OWNER TO postgres;

--
-- Name: document_processing_overview; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.document_processing_overview AS
 SELECT d.company_name,
    doc.deal_id,
    doc.id AS document_id,
    doc.file_name,
    doc.file_type,
    doc.file_size,
    doc.processing_status,
    doc.text_extracted,
    doc.embeddings_created,
    doc.text_chunks_count,
    count(e.id) AS actual_embedding_count,
    doc.processing_error,
    doc.n8n_execution_id,
    doc.created_at,
    doc.processed_at,
    EXTRACT(epoch FROM (COALESCE(doc.processed_at, CURRENT_TIMESTAMP) - doc.created_at)) AS processing_duration_seconds
   FROM ((public.deals d
     JOIN public.documents doc ON ((d.id = doc.deal_id)))
     LEFT JOIN public.embeddings e ON ((doc.id = e.document_id)))
  GROUP BY d.company_name, doc.deal_id, doc.id, doc.file_name, doc.file_type, doc.file_size, doc.processing_status, doc.text_extracted, doc.embeddings_created, doc.text_chunks_count, doc.processing_error, doc.n8n_execution_id, doc.created_at, doc.processed_at;


ALTER VIEW public.document_processing_overview OWNER TO postgres;

--
-- Name: embeddings_search_ready; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.embeddings_search_ready AS
 SELECT e.id,
    e.content,
    e.embedding,
    e.company_name,
    e.file_name,
    e.file_type,
    e.content_type,
    e.chunk_index,
    e.page_number,
    e.section_title,
    d.deal_name,
    d.deal_description,
    doc.file_size,
    doc.mime_type,
    doc.created_at AS document_uploaded_at,
    e.created_at AS embedding_created_at
   FROM ((public.embeddings e
     JOIN public.deals d ON ((e.deal_id = d.id)))
     JOIN public.documents doc ON ((e.document_id = doc.id)));


ALTER VIEW public.embeddings_search_ready OWNER TO postgres;

--
-- Name: n8n_chat_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.n8n_chat_histories (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    message jsonb NOT NULL
);


ALTER TABLE public.n8n_chat_histories OWNER TO postgres;

--
-- Name: n8n_chat_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.n8n_chat_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.n8n_chat_histories_id_seq OWNER TO postgres;

--
-- Name: n8n_chat_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.n8n_chat_histories_id_seq OWNED BY public.n8n_chat_histories.id;


--
-- Name: processing_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processing_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_id uuid,
    deal_id uuid,
    processing_step character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    message text,
    error_details jsonb,
    processing_time_ms integer,
    file_size_bytes bigint,
    text_length integer,
    chunks_created integer,
    tokens_used integer,
    n8n_execution_id character varying(100),
    n8n_node_name character varying(255),
    workflow_name character varying(255),
    openai_request_id character varying(100),
    google_api_quota_used integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT processing_logs_status_check CHECK (((status)::text = ANY ((ARRAY['started'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[])))
);


ALTER TABLE public.processing_logs OWNER TO postgres;

--
-- Name: processing_performance_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.processing_performance_summary AS
 SELECT processing_step,
    status,
    count(*) AS execution_count,
    avg(processing_time_ms) AS avg_processing_time_ms,
    sum(tokens_used) AS total_tokens_used,
    count(*) FILTER (WHERE ((status)::text = 'failed'::text)) AS failed_count,
    round((((count(*) FILTER (WHERE ((status)::text = 'failed'::text)))::numeric * 100.0) / (count(*))::numeric), 2) AS failure_rate_percent,
    min(created_at) AS first_execution,
    max(created_at) AS last_execution
   FROM public.processing_logs
  GROUP BY processing_step, status
  ORDER BY processing_step, status;


ALTER VIEW public.processing_performance_summary OWNER TO postgres;

--
-- Name: processing_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processing_stats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    date_period date NOT NULL,
    hour_period integer,
    files_processed integer DEFAULT 0,
    total_file_size_mb numeric(10,2) DEFAULT 0,
    total_chunks_created integer DEFAULT 0,
    pdfs_processed integer DEFAULT 0,
    images_processed integer DEFAULT 0,
    documents_processed integer DEFAULT 0,
    spreadsheets_processed integer DEFAULT 0,
    avg_processing_time_ms integer,
    total_openai_tokens_used integer DEFAULT 0,
    total_google_api_calls integer DEFAULT 0,
    failed_files integer DEFAULT 0,
    error_rate numeric(5,2) DEFAULT 0,
    estimated_openai_cost_usd numeric(8,4) DEFAULT 0,
    estimated_google_api_cost_usd numeric(8,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.processing_stats OWNER TO postgres;

--
-- Name: n8n_chat_histories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.n8n_chat_histories ALTER COLUMN id SET DEFAULT nextval('public.n8n_chat_histories_id_seq'::regclass);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: embeddings embeddings_document_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_document_id_chunk_index_key UNIQUE (document_id, chunk_index);


--
-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);


--
-- Name: n8n_chat_histories n8n_chat_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.n8n_chat_histories
    ADD CONSTRAINT n8n_chat_histories_pkey PRIMARY KEY (id);


--
-- Name: processing_logs processing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_logs
    ADD CONSTRAINT processing_logs_pkey PRIMARY KEY (id);


--
-- Name: processing_stats processing_stats_date_period_hour_period_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_stats
    ADD CONSTRAINT processing_stats_date_period_hour_period_key UNIQUE (date_period, hour_period);


--
-- Name: processing_stats processing_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_stats
    ADD CONSTRAINT processing_stats_pkey PRIMARY KEY (id);


--
-- Name: idx_deals_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_company_name ON public.deals USING btree (company_name);


--
-- Name: idx_deals_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_created_at ON public.deals USING btree (created_at DESC);


--
-- Name: idx_deals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_status ON public.deals USING btree (status);


--
-- Name: idx_documents_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_deal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_deal_id ON public.documents USING btree (deal_id);


--
-- Name: idx_documents_file_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_file_name ON public.documents USING gin (to_tsvector('english'::regconfig, (file_name)::text));


--
-- Name: idx_documents_file_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_file_type ON public.documents USING btree (file_type);


--
-- Name: idx_documents_n8n_execution; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_n8n_execution ON public.documents USING btree (n8n_execution_id) WHERE (n8n_execution_id IS NOT NULL);


--
-- Name: idx_documents_processing_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_processing_status ON public.documents USING btree (processing_status);


--
-- Name: idx_embeddings_chunk_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_chunk_index ON public.embeddings USING btree (document_id, chunk_index);


--
-- Name: idx_embeddings_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_company_name ON public.embeddings USING btree (company_name);


--
-- Name: idx_embeddings_content_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_content_hash ON public.embeddings USING btree (content_hash) WHERE (content_hash IS NOT NULL);


--
-- Name: idx_embeddings_content_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_content_type ON public.embeddings USING btree (content_type);


--
-- Name: idx_embeddings_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_created_at ON public.embeddings USING btree (created_at DESC);


--
-- Name: idx_embeddings_deal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_deal_id ON public.embeddings USING btree (deal_id);


--
-- Name: idx_embeddings_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_document_id ON public.embeddings USING btree (document_id);


--
-- Name: idx_embeddings_file_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_file_type ON public.embeddings USING btree (file_type);


--
-- Name: idx_embeddings_vector_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_embeddings_vector_hnsw ON public.embeddings USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_processing_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_logs_created_at ON public.processing_logs USING btree (created_at DESC);


--
-- Name: idx_processing_logs_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_logs_document_id ON public.processing_logs USING btree (document_id);


--
-- Name: idx_processing_logs_error_details; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_logs_error_details ON public.processing_logs USING gin (error_details) WHERE (error_details IS NOT NULL);


--
-- Name: idx_processing_logs_n8n_execution; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_logs_n8n_execution ON public.processing_logs USING btree (n8n_execution_id) WHERE (n8n_execution_id IS NOT NULL);


--
-- Name: idx_processing_logs_step_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_logs_step_status ON public.processing_logs USING btree (processing_step, status);


--
-- Name: idx_processing_stats_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_stats_date ON public.processing_stats USING btree (date_period DESC);


--
-- Name: idx_processing_stats_hour; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processing_stats_hour ON public.processing_stats USING btree (date_period, hour_period);


--
-- Name: embeddings trigger_update_document_processing_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_document_processing_status AFTER INSERT OR UPDATE ON public.embeddings FOR EACH ROW EXECUTE FUNCTION public.update_document_processing_status();


--
-- Name: deals update_deals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: documents update_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: embeddings update_embeddings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_embeddings_updated_at BEFORE UPDATE ON public.embeddings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: processing_stats update_processing_stats_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_processing_stats_updated_at BEFORE UPDATE ON public.processing_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: documents documents_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: embeddings embeddings_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: embeddings embeddings_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: processing_logs processing_logs_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_logs
    ADD CONSTRAINT processing_logs_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: processing_logs processing_logs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_logs
    ADD CONSTRAINT processing_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

