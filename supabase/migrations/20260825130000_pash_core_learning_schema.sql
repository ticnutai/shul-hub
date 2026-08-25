-- Runtime schema imported from ticnutai/pash commit
-- ae073088580b794a69bdfbf5f01b197253178fcc.
-- Target: Shul Hub only (bfiayuuhjtyccqobsjvl).
-- This copy intentionally contains no source-project identifier or credentials.

CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email)
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: learning_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sefer_id integer NOT NULL,
    sefer_name text NOT NULL,
    perek integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration integer,
    pasukim_covered text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_answers (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    question_id bigint NOT NULL,
    mefaresh text NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_shared boolean DEFAULT false
);


--
-- Name: user_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_answers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_answers_id_seq OWNED BY public.user_answers.id;


--
-- Name: user_bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    pasuk_text text NOT NULL,
    note text,
    tags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    content_type text NOT NULL,
    content_text text NOT NULL,
    mefaresh text,
    is_shared boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_content_content_type_check CHECK ((content_type = ANY (ARRAY['title'::text, 'question'::text, 'answer'::text])))
);


--
-- Name: user_highlights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    highlight_text text NOT NULL,
    color text NOT NULL,
    start_index integer NOT NULL,
    end_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    note_text text NOT NULL,
    is_shared boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_personal_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_personal_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    question_text text NOT NULL,
    answer_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_questions (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    title_id bigint NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_shared boolean DEFAULT false
);


--
-- Name: user_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_questions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_questions_id_seq OWNED BY public.user_questions.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    font_settings jsonb DEFAULT '{}'::jsonb,
    display_settings jsonb DEFAULT '{}'::jsonb,
    theme text DEFAULT 'classic'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    show_shared_content boolean DEFAULT true
);


--
-- Name: user_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_titles (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    pasuk_id text NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_shared boolean DEFAULT false
);


--
-- Name: user_titles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_titles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_titles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_titles_id_seq OWNED BY public.user_titles.id;


--
-- Name: user_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers ALTER COLUMN id SET DEFAULT nextval('public.user_answers_id_seq'::regclass);


--
-- Name: user_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_questions ALTER COLUMN id SET DEFAULT nextval('public.user_questions_id_seq'::regclass);


--
-- Name: user_titles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_titles ALTER COLUMN id SET DEFAULT nextval('public.user_titles_id_seq'::regclass);


--
-- Name: learning_sessions learning_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_sessions
    ADD CONSTRAINT learning_sessions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: user_answers user_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_pkey PRIMARY KEY (id);


--
-- Name: user_bookmarks user_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bookmarks
    ADD CONSTRAINT user_bookmarks_pkey PRIMARY KEY (id);


--
-- Name: user_content user_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_content
    ADD CONSTRAINT user_content_pkey PRIMARY KEY (id);


--
-- Name: user_highlights user_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_highlights
    ADD CONSTRAINT user_highlights_pkey PRIMARY KEY (id);


--
-- Name: user_notes user_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_pkey PRIMARY KEY (id);


--
-- Name: user_personal_questions user_personal_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_personal_questions
    ADD CONSTRAINT user_personal_questions_pkey PRIMARY KEY (id);


--
-- Name: user_questions user_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_questions
    ADD CONSTRAINT user_questions_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: user_titles user_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_titles
    ADD CONSTRAINT user_titles_pkey PRIMARY KEY (id);


--
-- Name: idx_learning_sessions_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_sessions_start_time ON public.learning_sessions USING btree (start_time);


--
-- Name: idx_learning_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_sessions_user_id ON public.learning_sessions USING btree (user_id);


--
-- Name: idx_user_answers_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_question_id ON public.user_answers USING btree (question_id);


--
-- Name: idx_user_answers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_user_id ON public.user_answers USING btree (user_id);


--
-- Name: idx_user_bookmarks_pasuk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_bookmarks_pasuk_id ON public.user_bookmarks USING btree (pasuk_id);


--
-- Name: idx_user_bookmarks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_bookmarks_user_id ON public.user_bookmarks USING btree (user_id);


--
-- Name: idx_user_questions_title_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_questions_title_id ON public.user_questions USING btree (title_id);


--
-- Name: idx_user_questions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_questions_user_id ON public.user_questions USING btree (user_id);


--
-- Name: idx_user_titles_pasuk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_titles_pasuk_id ON public.user_titles USING btree (pasuk_id);


--
-- Name: idx_user_titles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_titles_user_id ON public.user_titles USING btree (user_id);


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_answers update_user_answers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_answers_updated_at BEFORE UPDATE ON public.user_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_bookmarks update_user_bookmarks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_bookmarks_updated_at BEFORE UPDATE ON public.user_bookmarks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_content update_user_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_content_updated_at BEFORE UPDATE ON public.user_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_notes update_user_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON public.user_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_personal_questions update_user_personal_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_personal_questions_updated_at BEFORE UPDATE ON public.user_personal_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_questions update_user_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_questions_updated_at BEFORE UPDATE ON public.user_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_titles update_user_titles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_titles_updated_at BEFORE UPDATE ON public.user_titles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: learning_sessions learning_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_sessions
    ADD CONSTRAINT learning_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_answers user_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.user_questions(id) ON DELETE CASCADE;


--
-- Name: user_answers user_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_bookmarks user_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bookmarks
    ADD CONSTRAINT user_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_content user_content_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_content
    ADD CONSTRAINT user_content_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_highlights user_highlights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_highlights
    ADD CONSTRAINT user_highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_notes user_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_questions user_questions_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_questions
    ADD CONSTRAINT user_questions_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.user_titles(id) ON DELETE CASCADE;


--
-- Name: user_questions user_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_questions
    ADD CONSTRAINT user_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_titles user_titles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_titles
    ADD CONSTRAINT user_titles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: user_content Users can create own content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own content" ON public.user_content FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_highlights Users can create own highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own highlights" ON public.user_highlights FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_notes Users can create own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own notes" ON public.user_notes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_personal_questions Users can create own personal questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own personal questions" ON public.user_personal_questions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_settings Users can create own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_answers Users can create their own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own answers" ON public.user_answers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_bookmarks Users can create their own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own bookmarks" ON public.user_bookmarks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_questions Users can create their own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own questions" ON public.user_questions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: learning_sessions Users can create their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own sessions" ON public.learning_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_titles Users can create their own titles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own titles" ON public.user_titles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_content Users can delete own content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own content" ON public.user_content FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_highlights Users can delete own highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own highlights" ON public.user_highlights FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_notes Users can delete own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_personal_questions Users can delete own personal questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own personal questions" ON public.user_personal_questions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_answers Users can delete their own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own answers" ON public.user_answers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_bookmarks Users can delete their own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own bookmarks" ON public.user_bookmarks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_questions Users can delete their own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own questions" ON public.user_questions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: learning_sessions Users can delete their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own sessions" ON public.learning_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_titles Users can delete their own titles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own titles" ON public.user_titles FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_content Users can update own content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own content" ON public.user_content FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_notes Users can update own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_personal_questions Users can update own personal questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own personal questions" ON public.user_personal_questions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_settings Users can update own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_answers Users can update their own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own answers" ON public.user_answers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_bookmarks Users can update their own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own bookmarks" ON public.user_bookmarks FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_questions Users can update their own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own questions" ON public.user_questions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: learning_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own sessions" ON public.learning_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_titles Users can update their own titles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own titles" ON public.user_titles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_answers Users can view own answers and shared answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own answers and shared answers" ON public.user_answers FOR SELECT USING (((auth.uid() = user_id) OR (is_shared = true)));


--
-- Name: user_content Users can view own content and shared content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own content and shared content" ON public.user_content FOR SELECT USING (((auth.uid() = user_id) OR (is_shared = true)));


--
-- Name: user_highlights Users can view own highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own highlights" ON public.user_highlights FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_notes Users can view own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT USING (((auth.uid() = user_id) OR (is_shared = true)));


--
-- Name: user_personal_questions Users can view own personal questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own personal questions" ON public.user_personal_questions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_questions Users can view own questions and shared questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own questions and shared questions" ON public.user_questions FOR SELECT USING (((auth.uid() = user_id) OR (is_shared = true)));


--
-- Name: user_settings Users can view own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_titles Users can view own titles and shared titles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own titles and shared titles" ON public.user_titles FOR SELECT USING (((auth.uid() = user_id) OR (is_shared = true)));


--
-- Name: user_bookmarks Users can view their own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own bookmarks" ON public.user_bookmarks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: learning_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.learning_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: learning_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_bookmarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_content ENABLE ROW LEVEL SECURITY;

--
-- Name: user_highlights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_personal_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_personal_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_titles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


