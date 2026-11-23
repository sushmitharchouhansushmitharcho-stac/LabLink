import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronDown, MessageCircle, Search, Send, Sparkles,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Empty, QuestionCategoryIcon } from '../ui.jsx';
const stamp = (date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function CategoryCard({ category, selected, onSelect }) {
  return (
    <button type="button" className={`question-category ${selected ? 'question-category-selected' : ''}`} onClick={onSelect}>
      <span className="question-category-icon"><QuestionCategoryIcon name={category.icon} className="h-5 w-5" /></span>
      <span className="block font-semibold text-slate-100">{category.name}</span>
      <span className="mt-1 block text-sm leading-5 text-slate-400">{category.description}</span>
      <span className="mt-3 flex flex-wrap gap-1.5">
        {category.topics.slice(0, 3).map((topic) => <span key={topic} className="question-topic">{topic}</span>)}
      </span>
    </button>
  );
}

function QuestionCard({ question, category, onAnswer, onOpen }) {
  const [answer, setAnswer] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!answer.trim()) return;
    if (await onAnswer(question._id, answer)) setAnswer('');
  };
  return (
    <article className="question-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen(question._id)} className="question-title-link text-left">
          <h3 className="text-lg font-bold leading-snug text-white">{question.title}</h3>
        </button>
        <span className="question-category-pill"><QuestionCategoryIcon name={category?.icon} className="h-3.5 w-3.5" />{category?.name || question.category}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{question.body}</p>
      {question.tags?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{question.tags.map((tag) => <span key={tag} className="question-tag">#{tag}</span>)}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>{question.author?.name || 'LabLink member'}{question.author?.role ? ` · ${question.author.role}` : ''} · {stamp(question.createdAt)}</span>
        <span className="inline-flex items-center gap-1.5 text-cyan-200"><MessageCircle className="h-3.5 w-3.5" />{question.answerCount ?? question.answers?.length ?? 0} responses</span>
      </div>
      {question.answers?.length > 0 && (
        <div className="mt-4 space-y-3">
          {question.answers.map((item) => (
            <div key={item._id} className="question-answer">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.body}</p>
              <p className="mt-2 text-xs text-slate-400">{item.author?.name || 'LabLink member'} · {stamp(item.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
      <form className="question-reply-form mt-4" onSubmit={submit}>
        <input aria-label="Write a response" className="input" placeholder="Share a helpful response…" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={4000} />
        <button type="submit" className="btn-cyan" disabled={!answer.trim()}><Send className="h-4 w-4" /><span className="hidden sm:inline">Respond</span></button>
      </form>
    </article>
  );
}

export default function Questions() {
  const { questionId } = useParams();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const queryParam = searchParams.get('q') || '';
  const sortParam = searchParams.get('sort') === 'popular' ? 'popular' : 'recent';
  const mineParam = searchParams.get('mine') === 'true';
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(categoryParam);
  const [search, setSearch] = useState(queryParam);
  const [sort, setSort] = useState(sortParam);
  const [mine, setMine] = useState(mineParam);
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState({ items: [], total: 0, pages: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ title: '', body: '', category: categoryParam, tags: '' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api('/questions/categories').then(setCategories).catch((error) => notify(error.message, 'error'));
  }, [notify]);

  useEffect(() => {
    setCategory(categoryParam);
    setSearch(queryParam);
    setForm((current) => ({ ...current, category: categoryParam }));
    setSort(sortParam);
    setMine(mineParam);
  }, [categoryParam, queryParam, sortParam, mineParam]);

  useEffect(() => {
    if (!questionId) return undefined;
    let active = true;
    setLoading(true);
    setDetail(null);
    api(`/questions/${questionId}`)
      .then((question) => { if (active) setDetail(question); })
      .catch((error) => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [questionId, notify, refreshKey]);

  useEffect(() => {
    if (questionId) return undefined;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: search.trim(), sort, page: String(page), limit: '20' });
      if (category) params.set('category', category);
      if (mine) params.set('mine', 'true');
      api('/questions?' + params)
        .then((result) => { if (active) setQuestions(result); })
        .catch((error) => { if (active) notify(error.message, 'error'); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [questionId, category, search, sort, mine, page, refreshKey, notify]);

  const updateCategory = (value) => {
    setCategory(value);
    setPage(1);
    setForm((current) => ({ ...current, category: value }));
    const params = new URLSearchParams(searchParams);
    if (value) params.set('category', value);
    else params.delete('category');
    setSearchParams(params);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    setSearchParams(params);
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    setPosting(true);
    try {
      const question = await api('/questions', {
        method: 'POST',
        body: {
          title: form.title,
          body: form.body,
          category: form.category,
          tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        },
      });
      notify('Question posted');
      navigate(`/questions/${question._id}`);
      setForm((current) => ({ ...current, title: '', body: '', tags: '' }));
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setPosting(false);
    }
  };

  const respond = async (id, body) => {
    try {
      await api(`/questions/${id}/answers`, { method: 'POST', body: { body } });
      notify('Response posted');
      setRefreshKey((key) => key + 1);
      return true;
    } catch (error) {
      notify(error.message, 'error');
      return false;
    }
  };

  const openQuestion = (id) => navigate(`/questions/${id}`);
  const categoryById = (id) => categories.find((item) => item.id === id);

  if (questionId) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100" onClick={() => navigate('/questions')}><ArrowLeft className="h-4 w-4" />All questions</button>
        {loading ? <div className="card p-8 text-slate-400">Loading question…</div> : detail ? (
          <QuestionCard question={detail} category={categoryById(detail.category)} onAnswer={respond} onOpen={openQuestion} />
        ) : <Empty>This question could not be found.</Empty>}
      </div>
    );
  }

  const currentCategory = categoryById(category);
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-10">
      <header className="question-page-heading">
        <div className="landing-eyebrow"><Sparkles className="h-4 w-4" /> LABLINK COMMUNITY</div>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Questions &amp; discussions</h1>
        <p className="mt-2 max-w-2xl text-slate-400">Find your topic, ask the community, and share what you know.</p>
      </header>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-bold text-white">Explore by category</h2><p className="mt-1 text-sm text-slate-400">Choose a platform to find related discussions or focus your question.</p></div>
          {category && <button type="button" className="text-sm font-medium text-cyan-200 hover:text-white" onClick={() => updateCategory('')}>Clear category</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((item) => <CategoryCard key={item.id} category={item} selected={category === item.id} onSelect={() => updateCategory(category === item.id ? '' : item.id)} />)}
        </div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.85fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-bold text-white">{currentCategory?.name || 'Community questions'}</h2><p className="mt-1 text-sm text-slate-400">{currentCategory?.description || 'Search recent questions and popular discussions from across campus.'}</p></div>
            <button type="button" className={`question-filter ${mine ? 'question-filter-active' : ''}`} onClick={() => { setMine((value) => !value); setPage(1); }}>My questions</button>
          </div>
          <form onSubmit={submitSearch} className="question-search">
            <Search className="h-4 w-4 text-slate-400" />
            <input aria-label="Search questions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, topics or tags…" />
            <button type="submit" className="btn-cyan">Search</button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-400">{questions.total} {questions.total === 1 ? 'question' : 'questions'}</span>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">Sort
              <span className="relative"><select className="question-select" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="recent">Most recent</option><option value="popular">Most responses</option></select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-200" /></span>
            </label>
          </div>
          {loading ? <div className="card p-8 text-center text-slate-400">Loading questions…</div>
            : questions.items.length === 0 ? <Empty>No questions match yet. Try another search or start the discussion.</Empty>
              : <div className="space-y-4">{questions.items.map((item) => <QuestionCard key={item._id} question={item} category={categoryById(item.category)} onAnswer={respond} onOpen={openQuestion} />)}</div>}
          {questions.pages > 1 && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-slate-300">
            <button type="button" disabled={page <= 1} className="inline-flex items-center gap-1 disabled:opacity-40" onClick={() => setPage((value) => value - 1)}><ArrowLeft className="h-4 w-4" />Previous</button>
            <span>Page {page} of {questions.pages}</span>
            <button type="button" disabled={page >= questions.pages} className="inline-flex items-center gap-1 disabled:opacity-40" onClick={() => setPage((value) => value + 1)}>Next<ArrowRight className="h-4 w-4" /></button>
          </div>}
        </div>

        <aside className="question-compose card p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="question-category-icon"><MessageCircle className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-bold text-white">Ask the community</h2><p className="text-sm text-slate-400">Clear details help others help you.</p></div>
          </div>
          <form onSubmit={submitQuestion} className="space-y-4">
            <div><label className="label" htmlFor="question-category">Category <span className="text-cyan-300">*</span></label>
              <select id="question-category" className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
                <option value="">Choose a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="question-title">Title</label><input id="question-title" className="input" minLength={8} maxLength={140} required placeholder="What do you need help with?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div><label className="label" htmlFor="question-body">Details</label><textarea id="question-body" className="input min-h-32 resize-y" minLength={15} maxLength={6000} required placeholder="Add context, what you tried, or what you'd like to learn." value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></div>
            <div><label className="label" htmlFor="question-tags">Tags <span className="font-normal text-slate-500">(comma-separated)</span></label><input id="question-tags" className="input" placeholder="python, debugging" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></div>
            <button className="btn-cyan w-full" type="submit" disabled={posting || !form.category}>{posting ? 'Posting…' : 'Post question'}<ArrowRight className="h-4 w-4" /></button>
          </form>
          {currentCategory?.tags?.length > 0 && <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested tags</p><div className="flex flex-wrap gap-1.5">{currentCategory.tags.slice(0, 8).map((tag) => <button key={tag} type="button" className="question-tag hover:border-cyan-300/40" onClick={() => setForm((current) => ({ ...current, tags: current.tags ? `${current.tags}, ${tag}` : tag }))}>#{tag}</button>)}</div></div>}
        </aside>
      </section>
    </div>
  );
}
