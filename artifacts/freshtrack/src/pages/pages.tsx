import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownUp, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, Egg, Filter, Leaf, LockKeyhole, Mail, Package, Pencil, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, TrendingDown, Utensils, X } from 'lucide-react';
import { Button, EmptyBlock, ErrorBlock, LoadingBlock, PageTitle, Panel, StatusPill } from '@/components/fresh-ui';
import { AppShell } from '@/components/fresh-ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { expiryLabel, getExpiryStatus, prettyDate } from '@/lib/expiry';
import type { FoodItem } from '@/services/data';
import { useConsumption, useFood, useFoods, useFreshTrackWrites, useNotifications, useProfile } from '@/hooks/use-freshtrack';

const categories = ['Dairy','Fruits','Vegetables','Meat','Seafood','Grains','Bakery','Snacks','Beverages','Frozen','Canned','Condiments','Other'];
const locations = ['Refrigerator','Freezer','Pantry','Kitchen Counter','Other'];
const units = ['kg','g','L','ml','pieces','packets','boxes','bottles','cans'];
const foodSchema = z.object({
  name: z.string().trim().min(2, 'Add at least 2 characters.'),
  category: z.string().min(1, 'Choose a category.'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  unit: z.string().min(1, 'Choose a unit.'),
  purchase_date: z.string().optional().nullable(),
  expiry_date: z.string().min(1, 'Choose an expiry date.'),
  storage_location: z.string().min(1, 'Choose a storage location.'),
  brand: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
}).refine(v => !v.purchase_date || v.expiry_date >= v.purchase_date, { message: 'Expiry date cannot be before purchase date.', path: ['expiry_date'] });
type FoodFormValues = z.infer<typeof foodSchema>;
const defaultFood: FoodFormValues = { name:'', category:'Other', quantity:1, unit:'pieces', purchase_date:'', expiry_date:'', storage_location:'Refrigerator', brand:'', notes:'', image_url:'' };

function friendlyError() { return 'Something went wrong. Please try again.'; }
function ErrorNotice({ message }: { message: string }) { return <div className="inline-error" role="alert"><CircleAlert size={17}/>{message}</div>; }
function ConfigScreen() {
  return <div className="config-screen"><div className="config-card"><span className="brand-symbol"><Leaf size={21}/></span><div className="eyebrow">A QUICK KITCHEN SETUP</div><h1>FreshTrack needs its pantry connection.</h1><p>Connect this app to Supabase to securely save your account, food inventory, reminders and insights.</p><div className="config-steps"><div><span>01</span><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment.</p></div><div><span>02</span><p>Run the FreshTrack database setup in your Supabase project.</p></div></div><div className="config-foot"><ShieldCheck size={17}/> Your food data stays private to your account.</div></div></div>;
}

export function LandingPage() {
  return <div className="landing-page"><nav className="landing-nav"><Link href="/" className="brand"><span className="brand-symbol"><Leaf size={20}/></span><span>freshtrack<span className="brand-period">.</span></span></Link><div><a href="#how-it-works">How it works</a><a href="#why-freshtrack">Why FreshTrack</a></div><div className="landing-nav-actions"><Link href="/login" className="nav-login">Log in</Link><Link href="/signup" className="button button-primary">Start tracking <ArrowRight size={16}/></Link></div></nav>
    <section className="landing-hero"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-line"/>A calmer kitchen starts here</div><h1>Never waste<br/>good <em>food</em> again.</h1><p>Know what’s in your kitchen, what needs using, and what to make next. Less mental load. More meals that make it to the table.</p><div className="hero-actions"><Link href="/signup" className="button button-primary button-large">Start tracking <ArrowRight size={17}/></Link><a href="#how-it-works" className="button button-outline button-large">See how it works</a></div><div className="hero-note"><span className="avatar-stack"><i>F</i><i>K</i><i>+</i></span><span>For real kitchens, and real busy weeks.</span></div></div>
    <div className="hero-art" aria-label="Fresh groceries organized for the week"><div className="art-sun"/><div className="art-label">A GOOD THING<br/>TO KEEP TRACK OF</div><div className="produce-card produce-tomato"><span className="produce-shape tomato-shape"/></div><div className="produce-card produce-lemon"><span className="produce-shape lemon-shape"/></div><div className="produce-card produce-leaf"><span className="produce-shape leaf-shape"/></div><div className="produce-card produce-jar"><span className="jar-top"/><span className="jar-body"/></div><div className="hero-art-caption"><span className="caption-stamp"><Leaf size={17}/></span><span><b>Good food deserves</b><br/>to be remembered.</span></div><div className="art-sparkle sparkle-one"><Sparkles size={17}/></div><div className="art-sparkle sparkle-two"><Sparkles size={12}/></div></div></section>
    <div className="landing-strip"><span>THE SIMPLE WAY TO</span><b>Keep a clearer fridge</b><i/><b>Catch food before it fades</b><i/><b>Make less go to waste</b></div>
    <section id="why-freshtrack" className="problem-section"><div className="section-side"><span className="eyebrow">THE FRIDGE BLACK HOLE</span><h2>That second bag<br/>of spinach?</h2></div><div className="problem-copy"><p className="large-copy">It happens to all of us. Groceries get tucked behind the milk, the week gets busy, and perfectly good food gets forgotten.</p><p>FreshTrack gives everything in your kitchen a place and a gentle nudge at just the right time. No guilt. Just a clearer view of what you already have.</p><Link href="/signup" className="text-link">Make your kitchen easier <ArrowRight size={16}/></Link></div></section>
    <section id="how-it-works" className="how-section"><div className="section-heading"><span className="eyebrow">A LITTLE SYSTEM THAT HELPS</span><h2>From grocery bag<br/>to <em>good meal.</em></h2><p>Four small steps. A lot less forgotten food.</p></div><div className="steps-grid">{[['01','Add what you bring home','A quick note keeps your pantry and fridge in view.'],['02','Set the date','Choose an expiry date or use a handy time shortcut.'],['03','Get a gentle reminder','We’ll bring the right things back to mind.'],['04','Use it while it’s good','See what to eat first and celebrate what you saved.']].map(([n,title,body])=><article className="step-item" key={n}><div className="step-num">{n}</div><div className="step-rule"/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="feature-section"><div className="feature-image"><div className="feature-note"><span><CalendarDays size={17}/></span><div><b>Spinach</b><small>Use in the next 2 days</small></div><span className="feature-check"><Check size={15}/></span></div><div className="feature-note note-two"><span><Package size={17}/></span><div><b>Greek yogurt</b><small>Fresh for 8 more days</small></div><span className="feature-check"><Check size={15}/></span></div><div className="feature-image-stem"/></div><div className="feature-copy"><span className="eyebrow">IN YOUR CORNER</span><h2>A tiny nudge.<br/><em>A real difference.</em></h2><p>Keep a thoughtful list of the food you have, find the items that need attention, and make a little more room for the meals you actually want.</p><ul><li><Check size={16}/> Your food, sorted by freshness</li><li><Check size={16}/> Reminders on your schedule</li><li><Check size={16}/> Clear patterns, not calorie counts</li></ul><Link href="/signup" className="text-link">Meet your new kitchen helper <ArrowRight size={16}/></Link></div></section>
    <section className="landing-cta"><div className="cta-leaf"><Leaf size={25}/></div><span className="eyebrow">START WITH WHAT’S ALREADY THERE</span><h2>Make the most of<br/>what’s in your <em>kitchen.</em></h2><p>FreshTrack helps you spend less time keeping track — and less good food in the bin.</p><Link href="/signup" className="button button-dark button-large">Start your food-saving journey <ArrowRight size={17}/></Link></section>
    <footer className="landing-footer"><Link href="/" className="brand"><span className="brand-symbol"><Leaf size={17}/></span><span>freshtrack<span className="brand-period">.</span></span></Link><span>A little more thoughtful, one fridge at a time.</span><div><Link href="/login">Log in</Link><Link href="/signup">Create account</Link></div></footer>
  </div>;
}

function AuthFrame({ children, kicker = 'A calmer kitchen starts here' }: { children: ReactNode; kicker?: string }) {
  return <div className="auth-page"><div className="auth-aside"><Link href="/" className="brand"><span className="brand-symbol"><Leaf size={20}/></span><span>freshtrack<span className="brand-period">.</span></span></Link><div className="auth-aside-copy"><span className="eyebrow">{kicker}</span><h2>Good food<br/>is worth <em>remembering.</em></h2><p>Keep the things you love to eat in view, and let FreshTrack help with the rest.</p></div><div className="auth-aside-foot"><Sparkles size={17}/> Small habits make a lovely difference.</div></div><main className="auth-form-side">{children}</main></div>;
}

export function AuthPage({ mode }: { mode: 'login'|'signup'|'forgot'|'reset' }) {
  const [, navigate] = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const schema = isSignup
    ? z.object({ name:z.string().min(2,'Please enter your name.'),email:z.string().email('Enter a valid email address.'),password:z.string().min(8,'Use at least 8 characters.'),confirm:z.string() }).refine(v=>v.password===v.confirm,{path:['confirm'],message:'Those passwords don’t match.'})
    : isForgot
      ? z.object({email:z.string().email('Enter a valid email address.')})
      : isReset
        ? z.object({password:z.string().min(8,'Use at least 8 characters.')})
        : z.object({email:z.string().email('Enter a valid email address.'),password:z.string().min(8,'Use at least 8 characters.')});
  const form = useForm<any>({ resolver:zodResolver(schema), defaultValues:{name:'',email:'',password:'',confirm:''} });
  const submit = form.handleSubmit(async (values) => {
    setPending(true); setError('');
    try {
      if (isSignup) {
        const { data, error: authError } = await supabase!.auth.signUp({ email:values.email, password:values.password, options:{data:{full_name:values.name}} });
        if (authError) throw authError;
        if (data.user) {
          if (data.session) {
            const { error: profileError } = await supabase!.from('profiles').upsert({ id:data.user.id, full_name:values.name, email:values.email, notification_enabled:true, reminder_days_before:3 });
            if (profileError) throw profileError;
          }
        }
        toast.success('Your FreshTrack kitchen is ready.');
        navigate(data.session ? '/dashboard?welcome=1' : '/login');
      } else if (isForgot) {
        const { error: authError } = await supabase!.auth.resetPasswordForEmail(values.email, { redirectTo:`${window.location.origin}${import.meta.env.BASE_URL}reset-password` });
        if (authError) throw authError;
        setSent(true);
      } else if (isReset) {
        const { error: authError } = await supabase!.auth.updateUser({ password:values.password });
        if (authError) throw authError;
        toast.success('Password updated. Welcome back.');
        navigate('/dashboard');
      } else {
        const { error: authError } = await supabase!.auth.signInWithPassword({ email:values.email, password:values.password });
        if (authError) throw authError;
        navigate('/dashboard');
      }
    } catch { setError(isSignup ? 'We couldn’t create your account. Check your details and try again.' : 'We couldn’t complete that request. Check your details and try again.'); }
    finally { setPending(false); }
  });
  return <AuthFrame kicker={isSignup?'MAKE YOUR KITCHEN YOURS':isForgot?'ACCOUNT HELP':'WELCOME BACK'}><div className="auth-content"><Link className="auth-back" href="/"><ArrowLeft size={16}/> Back to FreshTrack</Link><div className="auth-heading"><span className="eyebrow">{isSignup?'A FRESH START':isForgot?'PASSWORD RESET':isReset?'NEW PASSWORD':'GOOD TO SEE YOU'}</span><h1>{isSignup?'Start with your kitchen.':isForgot?'Let’s get you back in.':isReset?'Choose a new password.':'Welcome back.'}</h1><p>{isSignup?'Create your free account and give good food a better chance.':isForgot?'We’ll send a secure link to the email on your account.':isReset?'Make it something strong and easy for you to remember.':'Your kitchen has been keeping a place for you.'}</p></div>
    {sent ? <div className="success-box"><span className="success-mark"><Mail size={20}/></span><h3>Check your inbox</h3><p>If an account exists for {form.getValues('email')}, a password reset link is on its way.</p><Link href="/login" className="button button-primary">Back to log in</Link></div> : <form onSubmit={submit} className="auth-form">
      {isSignup && <Field label="Full name" error={form.formState.errors.name?.message}><input autoComplete="name" placeholder="Your name" {...form.register('name')} data-testid="input-full-name"/></Field>}
      {!isReset && <Field label="Email address" error={form.formState.errors.email?.message}><div className="input-with-icon"><Mail size={16}/><input type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} data-testid="input-email"/></div></Field>}
      {!isForgot && <Field label={isReset?'New password':'Password'} error={form.formState.errors.password?.message}><div className="input-with-icon"><LockKeyhole size={16}/><input type="password" autoComplete={isSignup?'new-password':'current-password'} placeholder="At least 8 characters" {...form.register('password')} data-testid="input-password"/></div></Field>}
      {isSignup && <Field label="Confirm password" error={form.formState.errors.confirm?.message}><div className="input-with-icon"><LockKeyhole size={16}/><input type="password" autoComplete="new-password" placeholder="Enter it once more" {...form.register('confirm')} data-testid="input-confirm-password"/></div></Field>}
      {mode==='login' && <div className="form-inline"><label className="check-label"><input type="checkbox" defaultChecked/> <span>Keep me signed in</span></label><Link href="/forgot-password">Forgot password?</Link></div>}
      {error && <ErrorNotice message={error}/>}
      <Button type="submit" disabled={pending} className="auth-submit" data-testid="button-submit-auth">{pending?'One moment…':isSignup?'Create my account':isForgot?'Send reset link':isReset?'Update password':'Log in'} <ArrowRight size={16}/></Button>
    </form>}
    <p className="auth-switch">{isSignup?'Already have an account?':isForgot?'Remembered your password?':'New to FreshTrack?'} <Link href={isSignup?'/login':'/signup'}>{isSignup?'Log in':isForgot?'Back to log in':'Create an account'}</Link></p><div className="auth-trust"><ShieldCheck size={16}/> Your kitchen data is private to your account.</div></div></AuthFrame>;
}

function Field({ label, error, children, className = '' }: { label: string; error?: unknown; children: ReactNode; className?: string }) {
  return <label className={`form-field ${className}`}><span className="field-label">{label}</span>{children}{typeof error === 'string' && error.length > 0 && <small className="field-error">{error}</small>}</label>;
}

function FoodForm({ initial, editing, onSubmit, busy }: { initial?: FoodItem; editing?: boolean; onSubmit:(data:FoodFormValues)=>void; busy:boolean }) {
  const form = useForm<FoodFormValues>({ resolver:zodResolver(foodSchema), defaultValues:initial?{ ...defaultFood, ...initial, quantity:Number(initial.quantity) } as FoodFormValues:defaultFood });
  const purchase = form.watch('purchase_date');
  const setPreset = (days:number) => {
    const from = purchase ? new Date(`${purchase}T00:00:00`) : new Date();
    from.setDate(from.getDate()+days);
    form.setValue('expiry_date', `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`, {shouldValidate:true});
  };
  return <form className="food-form" onSubmit={form.handleSubmit(onSubmit)}>
    <Panel className="form-panel"><div className="form-section-head"><span className="form-step">01</span><div><h2>What’s in the kitchen?</h2><p>A few details make this item easy to find later.</p></div></div>
      <div className="form-grid"><Field label="Food name" error={form.formState.errors.name?.message}><input placeholder="e.g. Oat milk" {...form.register('name')} data-testid="input-food-name"/></Field>
        <Field label="Category" error={form.formState.errors.category?.message}><select {...form.register('category')} data-testid="select-food-category">{categories.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Quantity" error={form.formState.errors.quantity?.message}><div className="quantity-control"><input type="number" step="any" min="0.01" {...form.register('quantity')} data-testid="input-food-quantity"/><select aria-label="Unit" {...form.register('unit')} data-testid="select-food-unit">{units.map(x=><option key={x}>{x}</option>)}</select></div></Field>
        <Field label="Storage location"><select {...form.register('storage_location')} data-testid="select-food-location">{locations.map(x=><option key={x}>{x}</option>)}</select></Field>
      </div>
    </Panel>
    <Panel className="form-panel"><div className="form-section-head"><span className="form-step">02</span><div><h2>When should we remind you?</h2><p>Pick the dates that help you use it at its best.</p></div></div>
      <div className="form-grid"><Field label="Purchase date"><input type="date" {...form.register('purchase_date')} data-testid="input-purchase-date"/></Field><Field label="Expiry date" error={form.formState.errors.expiry_date?.message}><input type="date" {...form.register('expiry_date')} data-testid="input-expiry-date"/></Field></div>
      <div className="preset-row"><span>Quick set:</span>{[[1,'1 day'],[3,'3 days'],[7,'1 week'],[14,'2 weeks'],[30,'1 month'],[90,'3 months']].map(([n,label])=><button type="button" key={n} onClick={()=>setPreset(Number(n))} className="preset-chip" data-testid={`preset-expiry-${n}`}>{label}</button>)}</div>
    </Panel>
    <Panel className="form-panel"><div className="form-section-head"><span className="form-step">03</span><div><h2>A little extra detail</h2><p>Optional, but handy for the next grocery run.</p></div></div><div className="form-grid"><Field label="Brand (optional)"><input placeholder="e.g. Valley Farm" {...form.register('brand')} data-testid="input-food-brand"/></Field><Field label="Photo URL (optional)"><input placeholder="https://…" {...form.register('image_url')} data-testid="input-food-image"/></Field><Field label="Notes (optional)" className="span-two"><textarea rows={3} placeholder="Anything you’d like to remember about this food…" {...form.register('notes')} data-testid="input-food-notes"/></Field></div></Panel>
    <div className="form-actions"><Link href={editing && initial?`/inventory/${initial.id}`:'/inventory'} className="button button-quiet">Cancel</Link><Button type="submit" disabled={busy} data-testid="button-save-food">{busy?'Saving…':editing?'Save changes':'Add to my kitchen'} <ArrowRight size={16}/></Button></div>
  </form>;
}

function FoodRow({ food, onDelete }: { food:FoodItem; onDelete:(food:FoodItem)=>void }) {
  const status=getExpiryStatus(food.expiry_date);
  return <article className="food-row" data-testid={`food-row-${food.id}`}><Link href={`/inventory/${food.id}`} className={`food-avatar avatar-${food.category.toLowerCase().replaceAll(' ','-')}`}><FoodGlyph category={food.category}/></Link><div className="food-row-main"><Link href={`/inventory/${food.id}`} className="food-name">{food.name}</Link><span>{food.category}{food.brand?` · ${food.brand}`:''}</span></div><div className="food-quantity">{food.quantity} {food.unit}</div><div className="food-location">{food.storage_location}</div><div className="food-expiry"><StatusPill status={status}/><small>{expiryLabel(food.expiry_date)} · {prettyDate(food.expiry_date)}</small></div><div className="food-row-actions"><Link href={`/inventory/${food.id}`} className="icon-button" aria-label={`View ${food.name}`} data-testid={`view-food-${food.id}`}><ChevronRight size={18}/></Link><button className="icon-button" onClick={()=>onDelete(food)} aria-label={`Delete ${food.name}`} data-testid={`delete-food-${food.id}`}><Trash2 size={16}/></button></div></article>;
}
function FoodGlyph({category}: {category:string}) {
  const icon = category==='Dairy'?<Egg size={21}/>:category==='Meat'||category==='Seafood'?<Package size={21}/>:category==='Fruits'||category==='Vegetables'?<Leaf size={21}/>:<Package size={21}/>;
  return <>{icon}</>;
}
function ConfirmDelete({ food, onCancel, onConfirm, busy }: {food:FoodItem; onCancel:()=>void; onConfirm:()=>void; busy:boolean}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="modal-close" onClick={onCancel} aria-label="Close"><X/></button><div className="delete-icon"><Trash2/></div><span className="eyebrow">REMOVE FROM YOUR KITCHEN</span><h2 id="delete-title">Delete this food item?</h2><p>Are you sure you want to remove <strong>{food.name}</strong> from your inventory? This can’t be undone.</p><div className="modal-actions"><Button variant="outline" onClick={onCancel}>Keep it</Button><Button variant="danger" onClick={onConfirm} disabled={busy} data-testid="button-confirm-delete">{busy?'Removing…':'Delete item'}</Button></div></section></div>;
}

export function DashboardPage() {
  const [,navigate]=useLocation();
  const {user}=useSession();
  const {data:foods=[],isLoading,isError,refetch}=useFoods();
  const {data:profile}=useProfile();
  const {data:logs=[]}=useConsumption();
  const {data:notes=[]}=useNotifications();
  const writes=useFreshTrackWrites();
  const params = new URLSearchParams(window.location.search);
  const [welcome,setWelcome]=useState(params.get('welcome')==='1');
  const [consumeFood,setConsumeFood]=useState<FoodItem|null>(null);
  const [deleteFood,setDeleteFood]=useState<FoodItem|null>(null);
  const [amount,setAmount]=useState(1);
  const counts=useMemo(()=>foods.reduce((a,f)=>{a[getExpiryStatus(f.expiry_date)]++;return a},{expired:0,today:0,soon:0,fresh:0}),[foods]);
  const priority=foods.filter(f=>['expired','today'].includes(getExpiryStatus(f.expiry_date))).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date));
  const expiring=foods.filter(f=>['today','soon','expired'].includes(getExpiryStatus(f.expiry_date))).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date)).slice(0,4);
  const recent=[...foods].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,4);
  const categoryData=Object.entries(foods.reduce((a,f)=>{a[f.category]=(a[f.category]||0)+1;return a;},{} as Record<string,number>)).map(([name,value])=>({name,value}));
  const unread=notes.filter((n:any)=>!n.is_read).length;
  const greeting=new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening';
  const markConsumed=async () => {
    if(!consumeFood)return;
    try { await writes.consume.mutateAsync({food:consumeFood,quantity:amount}); toast.success(amount>=Number(consumeFood.quantity)?'Nice! You saved this food from going to waste.':'Consumption logged.'); setConsumeFood(null); }
    catch { toast.error(friendlyError()); }
  };
  const seedSampleKitchen=async()=>{
    try{const count=await writes.seedDemo.mutateAsync();toast.success(count?`${count} sample foods added to your kitchen.`:'Your sample kitchen is already loaded.');}
    catch{toast.error('We couldn’t load the sample foods. Please check your Supabase setup and try again.')}
  };
  const deleteItem=async()=>{if(!deleteFood)return;try{await writes.remove.mutateAsync(deleteFood.id);toast.success('Food item deleted.');setDeleteFood(null)}catch{toast.error(friendlyError())}};
  return <AppShell><PageTitle eyebrow={profile?.household_name||'YOUR KITCHEN'} title={`${greeting}, ${(profile?.full_name||user?.email?.split('@')[0]||'there').split(' ')[0]}.`} description="Here’s what’s happening in your kitchen." action={<Button onClick={()=>navigate('/inventory/add')} data-testid="button-quick-add"><Plus size={17}/> Add food</Button>}/>
    {isLoading?<div className="summary-grid">{[1,2,3,4].map(i=><div className="summary-card skeleton-card" key={i}><b/><i/><small/></div>)}</div>:isError?<ErrorBlock retry={()=>void refetch()}/>:<>
    <div className="summary-grid"><SummaryCard label="In your kitchen" value={foods.length} note="tracked items" icon={<Package size={18}/>} className="sum-green"/><SummaryCard label="Use soon" value={counts.today+counts.soon} note={counts.today?`${counts.today} need attention today`:'Within the next 3 days'} icon={<Clock3 size={18}/>} className="sum-amber"/><SummaryCard label="Past date" value={counts.expired} note="check these items" icon={<CircleAlert size={18}/>} className="sum-coral"/><SummaryCard label="Looking good" value={counts.fresh} note="fresh for a while" icon={<Leaf size={18}/>} className="sum-sage"/></div>
    <div className={`priority-banner ${priority.length?'priority-attention':'priority-good'}`}><span className="priority-icon">{priority.length?<Clock3 size={20}/>:<Check size={20}/>}</span><div><span className="eyebrow">TODAY’S PRIORITY</span><h2>{priority.length?(counts.expired?'Check these past-date items first.':'Use these foods today.'):'You’re all caught up. Your kitchen is looking good.'}</h2><p>{priority.length?`${priority.length} ${priority.length===1?'item needs':'items need'} a little attention.`:'Nothing urgent on your list today.'}</p></div>{priority.length>0&&<Link href="/expiring" className="banner-link">See items <ArrowRight size={16}/></Link>}</div>
     <div className="dashboard-columns"><section className="dashboard-main-column"><Panel className="section-panel"><div className="panel-heading"><div><span className="eyebrow">MAKE IT A GOOD MEAL</span><h2>Eat these first</h2></div><Link href="/expiring" className="panel-link">See all <ArrowRight size={15}/></Link></div>{expiring.length? <div className="mini-food-list">{expiring.map(f=><div className="mini-food" key={f.id}><span className="food-avatar small"><FoodGlyph category={f.category}/></span><div className="mini-food-copy"><Link href={`/inventory/${f.id}`}>{f.name}</Link><span>{f.category} · {f.quantity} {f.unit}</span></div><div className="mini-food-date"><StatusPill status={getExpiryStatus(f.expiry_date)}/><small>{expiryLabel(f.expiry_date)}</small></div><button className="icon-button" aria-label={`Mark ${f.name} as consumed`} onClick={()=>{setConsumeFood(f);setAmount(Number(f.quantity))}} data-testid={`consume-${f.id}`}><Check size={17}/></button></div>)}</div>:<EmptyBlock title={foods.length?"You're all caught up!":"Start with what’s in your kitchen"} detail={foods.length?"No food needs attention in the next few days.":"Add your groceries and FreshTrack will help you keep an eye on them."} action={!foods.length?<div className="demo-actions"><Link href="/inventory/add" className="button button-primary">Add your first food</Link><Button variant="outline" disabled={writes.seedDemo.isPending} onClick={()=>void seedSampleKitchen()}>{writes.seedDemo.isPending?'Loading sample foods…':'Try sample foods'}</Button></div>:undefined}/>}</Panel>
    <Panel className="section-panel"><div className="panel-heading"><div><span className="eyebrow">JUST BROUGHT IN</span><h2>Recently added</h2></div><Link href="/inventory" className="panel-link">Inventory <ArrowRight size={15}/></Link></div>{recent.length?<div className="recent-grid">{recent.map(f=><Link href={`/inventory/${f.id}`} className="recent-card" key={f.id}><span className="food-avatar"><FoodGlyph category={f.category}/></span><span className="recent-name">{f.name}</span><span>{f.quantity} {f.unit} · {f.storage_location}</span></Link>)}</div>:<EmptyBlock title="Nothing tucked away yet" detail="Your latest additions will appear here."/ >}</Panel></section>
    <aside className="dashboard-side-column"><Panel className="distribution-panel"><div className="panel-heading"><div><span className="eyebrow">WHAT’S INSIDE</span><h2>Your food mix</h2></div><Link href="/analytics" className="icon-button" aria-label="See insights"><ArrowRight size={17}/></Link></div>{categoryData.length?<><div className="donut-chart"><ResponsiveContainer width="100%" height={165}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={3}>{categoryData.map((_,i)=><Cell key={i} fill={['#4b8064','#e2b75b','#df7861','#8fae9b','#93aeb1','#bda9cc'][i%6]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="donut-center"><b>{foods.length}</b><span>items</span></div></div><div className="category-legend">{categoryData.slice(0,5).map((c,i)=><div key={c.name}><i style={{background:['#4b8064','#e2b75b','#df7861','#8fae9b','#93aeb1'][i%5]}}/><span>{c.name}</span><b>{c.value}</b></div>)}</div></>:<div className="chart-empty">Add food to see your kitchen mix.</div>}</Panel>
    <Panel className="reminder-card"><div className="reminder-icon"><Bell size={17}/></div><span className="eyebrow">A LITTLE NUDGE</span><h3>{unread?`${unread} reminders to check in on.`:'Your reminders are here when you need them.'}</h3><Link href="/notifications" className="text-link">See reminders <ArrowRight size={15}/></Link></Panel>
    </aside></div>
    </>}
    {welcome&&<div className="modal-backdrop"><section className="welcome-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={()=>setWelcome(false)} aria-label="Close"><X/></button><div className="welcome-sprig"><Leaf size={29}/></div><span className="eyebrow">A FRESH START</span><h2>Welcome to FreshTrack.</h2><p>We’ll help you make the most of what’s in your kitchen. Add your first food, set a date, and we’ll help you remember it.</p><div className="welcome-steps"><span><i>1</i>Add your first food</span><span><i>2</i>Set its expiry date</span><span><i>3</i>Get a helpful reminder</span></div><Button onClick={()=>navigate('/inventory/add')}>Add my first food <ArrowRight size={16}/></Button><button className="text-button" onClick={()=>setWelcome(false)}>Skip for now</button></section></div>}
    {consumeFood&&<ConsumeDialog food={consumeFood} amount={amount} setAmount={setAmount} onClose={()=>setConsumeFood(null)} onSubmit={markConsumed} busy={writes.consume.isPending}/>}
    {deleteFood&&<ConfirmDelete food={deleteFood} onCancel={()=>setDeleteFood(null)} onConfirm={deleteItem} busy={writes.remove.isPending}/>}
  </AppShell>;
}
function SummaryCard({label,value,note,icon,className}: {label:string;value:number;note:string;icon:ReactNode;className:string}) { return <div className={`summary-card ${className}`}><div className="summary-top"><span>{label}</span><i>{icon}</i></div><div className="summary-number">{value}</div><div className="summary-note">{note}</div></div>; }
function ConsumeDialog({food,amount,setAmount,onClose,onSubmit,busy}: {food:FoodItem;amount:number;setAmount:(n:number)=>void;onClose:()=>void;onSubmit:()=>void;busy:boolean}) {
  return <div className="modal-backdrop"><section className="confirm-modal consume-modal" role="dialog" aria-modal="true" aria-labelledby="consume-title"><button className="modal-close" onClick={onClose} aria-label="Close"><X/></button><div className="consume-mark"><Utensils size={21}/></div><span className="eyebrow">NICE WORK, COOK</span><h2 id="consume-title">How much did you use?</h2><p>Log what you enjoyed. We’ll keep the rest in your kitchen list.</p><div className="consume-quantity"><button onClick={()=>setAmount(Math.max(0.01,Number((amount-0.5).toFixed(2))))} aria-label="Decrease quantity">−</button><input type="number" min="0.01" max={food.quantity} step="any" value={amount} onChange={e=>setAmount(Math.min(Number(food.quantity),Number(e.target.value)))} aria-label="Quantity used"/><span>{food.unit}</span><button onClick={()=>setAmount(Math.min(Number(food.quantity),Number((amount+0.5).toFixed(2))))} aria-label="Increase quantity">+</button></div><small>Available: {food.quantity} {food.unit}</small><div className="modal-actions"><Button variant="outline" onClick={onClose}>Not yet</Button><Button onClick={onSubmit} disabled={busy||amount<=0}>{busy?'Saving…':amount>=Number(food.quantity)?'Consumed entire item':'Log what I used'} <Check size={16}/></Button></div></section></div>;
}

export function InventoryPage({expiringOnly=false}: {expiringOnly?:boolean}) {
  const {data:foods=[],isLoading,isError,refetch}=useFoods();
  const writes=useFreshTrackWrites();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [category,setCategory]=useState('all');
  const [location,setLocation]=useState('all');
  const [sort,setSort]=useState('expiry');
  const [deleteFood,setDeleteFood]=useState<FoodItem|null>(null);
  const [searchTerm,setSearchTerm]=useState('');
  useEffect(()=>{const t=setTimeout(()=>setSearchTerm(query.trim().toLowerCase()),160);return()=>clearTimeout(t)},[query]);
  const filtered=useMemo(()=>foods.filter(f=>{
    const current=getExpiryStatus(f.expiry_date);
    if(expiringOnly&&!['expired','today','soon'].includes(current))return false;
    if(status!=='all'&&!((status==='soon'&&['today','soon'].includes(current))||current===status))return false;
    if(category!=='all'&&f.category!==category)return false;
    if(location!=='all'&&f.storage_location!==location)return false;
    if(searchTerm&&!`${f.name} ${f.brand??''} ${f.category} ${f.notes??''}`.toLowerCase().includes(searchTerm))return false;
    return true;
  }),[foods,expiringOnly,status,category,location,searchTerm]).sort((a,b)=>sort==='expiry'?a.expiry_date.localeCompare(b.expiry_date):sort==='latest'?b.expiry_date.localeCompare(a.expiry_date):sort==='recent'?b.created_at.localeCompare(a.created_at):sort==='z'?b.name.localeCompare(a.name):a.name.localeCompare(b.name));
  const remove=async()=>{if(!deleteFood)return;try{await writes.remove.mutateAsync(deleteFood.id);toast.success('Food item deleted.');setDeleteFood(null)}catch{toast.error(friendlyError())}};
  const seedSampleKitchen=async()=>{try{const count=await writes.seedDemo.mutateAsync();toast.success(count?`${count} sample foods added to your kitchen.`:'Your sample kitchen is already loaded.')}catch{toast.error('We couldn’t load the sample foods. Please check your Supabase setup and try again.')}};
  return <AppShell><PageTitle eyebrow={expiringOnly?'A HELPFUL HEADS-UP':'THE WHOLE KITCHEN'} title={expiringOnly?'Eat these first':'My food inventory'} description={expiringOnly?'A short list of what needs a little attention.':'Everything you’ve tucked away, all in one place.'} action={<Link href="/inventory/add" className="button button-primary" data-testid="link-add-food"><Plus size={17}/> Add food</Link>}/>
    <div className="inventory-toolbar"><label className="search-box"><Search size={17}/><input placeholder="Search name, brand or notes…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search food inventory" data-testid="input-search-inventory"/>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={15}/></button>}</label><div className="filter-select"><Filter size={15}/><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter by category" data-testid="filter-category"><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div><div className="filter-select"><Package size={15}/><select value={location} onChange={e=>setLocation(e.target.value)} aria-label="Filter by storage" data-testid="filter-location"><option value="all">All locations</option>{locations.map(c=><option key={c}>{c}</option>)}</select></div><div className="filter-select"><ArrowDownUp size={15}/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort inventory" data-testid="sort-inventory"><option value="expiry">Expiry: nearest</option><option value="latest">Expiry: latest</option><option value="recent">Recently added</option><option value="az">Name A–Z</option><option value="z">Name Z–A</option></select></div></div>
    <div className="status-tabs" role="tablist" aria-label="Filter by freshness">{[['all','All food'],['fresh','Fresh'],['soon','Expiring soon'],['expired','Expired']].map(([key,label])=><button key={key} className={status===key?'active':''} onClick={()=>setStatus(key)} role="tab" aria-selected={status===key} data-testid={`filter-status-${key}`}>{label}<span>{key==='all'?foods.length:key==='soon'?foods.filter(f=>['today','soon'].includes(getExpiryStatus(f.expiry_date))).length:foods.filter(f=>getExpiryStatus(f.expiry_date)===key).length}</span></button>)}</div>
     {isLoading?<Panel><LoadingBlock rows={5}/></Panel>:isError?<ErrorBlock retry={()=>void refetch()}/>:foods.length===0?<EmptyBlock title="Your kitchen is empty… let’s change that!" detail="Add a few things you already have and we’ll help you keep them fresh." action={<div className="demo-actions"><Link href="/inventory/add" className="button button-primary"><Plus size={16}/> Add your first food</Link><Button variant="outline" disabled={writes.seedDemo.isPending} onClick={()=>void seedSampleKitchen()}>{writes.seedDemo.isPending?'Loading sample foods…':'Try sample foods'}</Button></div>}/>:filtered.length===0?<EmptyBlock title={searchTerm?`No foods found for “${query}”.`:"Nothing matches these filters."} detail="Try a different search or clear one of the filters." action={<Button variant="outline" onClick={()=>{setQuery('');setStatus('all');setCategory('all');setLocation('all')}}>Clear filters</Button>}/>:<Panel className="inventory-panel"><div className="inventory-table-head"><span>FOOD & CATEGORY</span><span>QUANTITY</span><span>STORED IN</span><span>FRESHNESS</span><span className="sr-only">Actions</span></div>{filtered.map(f=><FoodRow key={f.id} food={f} onDelete={setDeleteFood}/>)}</Panel>}
    <div className="inventory-foot"><span>{filtered.length} {filtered.length===1?'item':'items'} in view</span><span><SlidersHorizontal size={14}/> Sorted by {sort==='expiry'?'nearest expiry':sort==='latest'?'latest expiry':sort==='recent'?'recently added':sort==='z'?'name Z to A':'name A to Z'}</span></div>
    {deleteFood&&<ConfirmDelete food={deleteFood} onCancel={()=>setDeleteFood(null)} onConfirm={remove} busy={writes.remove.isPending}/>}
  </AppShell>;
}

export function FoodFormPage({editing=false}: {editing?:boolean}) {
  const params=useParams<{id:string}>();
  const {data:food,isLoading,isError,refetch}=useFood(params.id);
  const writes=useFreshTrackWrites();
  const [,navigate]=useLocation();
  const submit=async(data:FoodFormValues)=>{
    try {
      const normalized={...data,purchase_date:data.purchase_date||null,brand:data.brand||null,notes:data.notes||null,image_url:data.image_url||null,quantity:Number(data.quantity)};
      if(editing&&params.id){await writes.update.mutateAsync({id:params.id,draft:normalized});toast.success('Food item updated.');navigate(`/inventory/${params.id}`)}
      else {const result=await writes.create.mutateAsync(normalized);toast.success(`${result.name} added to your kitchen.`);navigate('/inventory')}
    }catch{toast.error(editing?'We couldn’t update this food item.':'We couldn’t save this food item. Please try again.')}
  };
  if(editing&&isLoading)return <AppShell><LoadingBlock/></AppShell>;
  if(editing&&(isError||!food))return <AppShell><ErrorBlock retry={()=>void refetch()}/></AppShell>;
  return <AppShell><Link href={editing?`/inventory/${params.id}`:'/inventory'} className="back-link"><ArrowLeft size={16}/> {editing?'Back to food details':'Back to inventory'}</Link><PageTitle eyebrow={editing?'TUNE UP YOUR LIST':'A NEW ADDITION'} title={editing?'Edit food':'Add food to your kitchen'} description={editing?'Keep the details up to date and FreshTrack will do the rest.':'A quick entry now makes it easier to use every good thing later.'}/><div className="food-form-layout"><FoodForm initial={food} editing={editing} onSubmit={submit} busy={writes.create.isPending||writes.update.isPending}/><aside className="form-aside"><div className="form-aside-art"><div className="aside-orbit"/><span><Leaf size={29}/></span></div><span className="eyebrow">A SMART LITTLE SHORTCUT</span><h3>Dates don’t have to be a chore.</h3><p>Tap one of the quick-set buttons and we’ll fill in an expiry date for you. You can always adjust it after.</p><div className="aside-tip"><Sparkles size={15}/> Your food stays private to your household.</div></aside></div></AppShell>;
}

export function FoodDetailsPage() {
  const params=useParams<{id:string}>();
  const {data:food,isLoading,isError,refetch}=useFood(params.id);
  const {data:logs=[]}=useConsumption();
  const writes=useFreshTrackWrites();
  const [,navigate]=useLocation();
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [consumeOpen,setConsumeOpen]=useState(false);
  const [amount,setAmount]=useState(1);
  if(isLoading)return <AppShell><LoadingBlock rows={4}/></AppShell>;
  if(isError||!food)return <AppShell><ErrorBlock retry={()=>void refetch()}/></AppShell>;
  const remove=async()=>{try{await writes.remove.mutateAsync(food.id);toast.success('Food item deleted.');navigate('/inventory')}catch{toast.error(friendlyError())}};
  const consume=async()=>{try{await writes.consume.mutateAsync({food,quantity:amount});toast.success(amount>=Number(food.quantity)?'Nice! You saved this food from going to waste.':'Consumption logged.');navigate('/inventory')}catch{toast.error(friendlyError())}};
  const itemLogs=logs.filter((l:any)=>l.food_item_id===food.id);
  const status=getExpiryStatus(food.expiry_date);
  return <AppShell><Link href="/inventory" className="back-link"><ArrowLeft size={16}/> Back to inventory</Link><div className="detail-layout"><div className="detail-main"><div className={`detail-cover cover-${food.category.toLowerCase().replaceAll(' ','-')}`}><div className="detail-deco deco-a"/><div className="detail-deco deco-b"/><span className="detail-food-icon"><FoodGlyph category={food.category}/></span><span className="detail-category">{food.category}</span></div><div className="detail-title-line"><div><span className="eyebrow">{food.brand||food.category.toUpperCase()}</span><h1>{food.name}</h1></div><StatusPill status={status}/></div><p className="detail-countdown">{expiryLabel(food.expiry_date)} <span>·</span> Best before {prettyDate(food.expiry_date)}</p><div className="detail-actions"><Link href={`/inventory/${food.id}/edit`} className="button button-primary"><Pencil size={16}/> Edit food</Link><Button variant="outline" onClick={()=>{setAmount(Number(food.quantity));setConsumeOpen(true)}}><Utensils size={16}/> Mark as consumed</Button><Button variant="quiet" className="delete-text-button" onClick={()=>setDeleteOpen(true)}><Trash2 size={16}/> Delete</Button></div><Panel className="detail-info-panel"><h2>At a glance</h2><div className="detail-info-grid"><DetailField label="Quantity" value={`${food.quantity} ${food.unit}`}/><DetailField label="Stored in" value={food.storage_location}/><DetailField label="Purchased" value={prettyDate(food.purchase_date)}/><DetailField label="Expiry date" value={prettyDate(food.expiry_date)}/><DetailField label="Added to FreshTrack" value={prettyDate(food.created_at?.slice(0,10))}/></div>{food.notes&&<div className="detail-notes"><span>Notes</span><p>{food.notes}</p></div>}</Panel>
    {itemLogs.length>0&&<Panel className="detail-info-panel"><div className="panel-heading"><div><span className="eyebrow">GOOD FOOD, USED WELL</span><h2>Consumption history</h2></div></div>{itemLogs.slice(0,4).map((l:any)=><div className="log-row" key={l.id}><span className="log-dot"><Check size={13}/></span><span>{l.quantity_used} {food.unit} used</span><small>{new Date(l.consumed_at).toLocaleDateString()}</small></div>)}</Panel>}</div><aside className="detail-side"><Panel className="status-detail"><span className="eyebrow">FRESHNESS CHECK</span><StatusPill status={status}/><h3>{status==='expired'?'Past its best date':status==='today'?'Use this one today':status==='soon'?'Good to use soon':'Looking good'}</h3><p>{status==='expired'?'Check the item before using it and remove it if it’s no longer good.':status==='today'?'If it still looks and smells good, plan to enjoy it today.':status==='soon'?'Keep this one near the front of the fridge so it’s easy to reach.':'There’s time. We’ll give you a nudge when it’s getting closer.'}</p></Panel><Panel className="detail-side-note"><Sparkles size={17}/><h3>Every little bit counts.</h3><p>Logging what you use helps you see the progress your household is making.</p></Panel></aside></div>
    {deleteOpen&&<ConfirmDelete food={food} onCancel={()=>setDeleteOpen(false)} onConfirm={remove} busy={writes.remove.isPending}/>}
    {consumeOpen&&<ConsumeDialog food={food} amount={amount} setAmount={setAmount} onClose={()=>setConsumeOpen(false)} onSubmit={consume} busy={writes.consume.isPending}/>}
  </AppShell>;
}
function DetailField({label,value}: {label:string;value:string}) { return <div className="detail-field"><span>{label}</span><b>{value}</b></div>; }

export function NotificationsPage() {
  const {data:notifications=[],isLoading,isError,refetch}=useNotifications();
  const writes=useFreshTrackWrites();
  const sorted=[...notifications].sort((a:any,b:any)=>b.created_at.localeCompare(a.created_at));
  const markAll=async()=>{try{await writes.markAllRead.mutateAsync();toast.success('All caught up.')}catch{toast.error(friendlyError())}};
  const markOne=async(id:string)=>{try{await writes.markRead.mutateAsync(id)}catch{toast.error(friendlyError())}};
  return <AppShell><PageTitle eyebrow="A FRIENDLY REMINDER" title="Your reminders" description="Little nudges about the food you want to remember." action={notifications.some((n:any)=>!n.is_read)?<Button variant="outline" onClick={markAll} disabled={writes.markAllRead.isPending}><Check size={16}/> Mark all as read</Button>:undefined}/>
    {isLoading?<Panel><LoadingBlock rows={5}/></Panel>:isError?<ErrorBlock retry={()=>void refetch()}/>:sorted.length===0?<EmptyBlock title="You’re all clear." detail="When something in your kitchen needs attention, you’ll find a gentle reminder here."/>:<div className="notification-list">{sorted.map((note:any)=><article className={`notification-item ${note.is_read?'':'notification-unread'}`} key={note.id} data-testid={`notification-${note.id}`}><span className={`notification-symbol ${note.type==='expired'?'notice-expired':note.type==='system'?'notice-system':'notice-soon'}`}>{note.type==='expired'?<CircleAlert size={18}/>:note.type==='system'?<Sparkles size={18}/>:<Clock3 size={18}/>}</span><div className="notification-copy"><div className="notification-heading"><h3>{note.title}</h3>{!note.is_read&&<span className="unread-label">NEW</span>}</div><p>{note.message}</p>{note.expiry_date&&<small>Best before {prettyDate(note.expiry_date)}</small>}<small>{new Date(note.created_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div>{!note.is_read&&<button className="mark-read-button" onClick={()=>void markOne(note.id)} data-testid={`mark-read-${note.id}`}>Mark read</button>}</article>)}</div>}
  </AppShell>;
}

export function AnalyticsPage() {
  const {data:foods=[],isLoading,isError,refetch}=useFoods();
  const {data:logs=[]}=useConsumption();
  const stats=useMemo(()=>{
    const now=new Date();
    const months=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,name:d.toLocaleDateString(undefined,{month:'short'}),added:0,used:0}});
    foods.forEach(f=>{const m=months.find(x=>x.key===f.created_at.slice(0,7));if(m)m.added++});
    logs.forEach((l:any)=>{const m=months.find(x=>x.key===String(l.consumed_at).slice(0,7));if(m)m.used++});
    const byCategory=Object.entries(foods.reduce((a,f)=>{a[f.category]=(a[f.category]||0)+1;return a;},{} as Record<string,number>)).map(([name,value])=>({name,value}));
    const expired=foods.filter(f=>getExpiryStatus(f.expiry_date)==='expired').length;
    const consumed=logs.length;
    const distribution=[{name:'Fresh',value:foods.filter(f=>getExpiryStatus(f.expiry_date)==='fresh').length},{name:'Use soon',value:foods.filter(f=>['today','soon'].includes(getExpiryStatus(f.expiry_date))).length},{name:'Past date',value:expired}].filter(x=>x.value);
    const monthLogs=logs.filter((l:any)=>String(l.consumed_at).slice(0,7)===`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`).length;
    const soon=foods.filter(f=>['today','soon'].includes(getExpiryStatus(f.expiry_date)));
    const riskyCategory=soon.reduce((a,f)=>{a[f.category]=(a[f.category]||0)+1;return a;},{} as Record<string,number>);
    const topCategory=Object.entries(riskyCategory).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return {months,byCategory,expired,consumed,distribution,monthLogs,soon,topCategory};
  },[foods,logs]);
  return <AppShell><PageTitle eyebrow="A THOUGHTFUL LOOK BACK" title="Food insights" description="See the small habits adding up in your kitchen."/>{isLoading?<div className="analytics-grid">{[1,2,3,4].map(x=><Panel key={x}><LoadingBlock rows={2}/></Panel>)}</div>:isError?<ErrorBlock retry={()=>void refetch()}/>:foods.length===0&&logs.length===0?<EmptyBlock title="A little more data, a lot more insight." detail="Add a few food items and log what you use to unlock your household’s patterns." action={<Link href="/inventory/add" className="button button-primary"><Plus size={16}/> Add your first food</Link>} />:<>
    <div className="insight-banner"><span><Sparkles size={19}/></span><div><span className="eyebrow">A USEFUL LITTLE INSIGHT</span><p>{stats.soon.length?`You have ${stats.soon.length} ${stats.soon.length===1?'item':'items'} coming up soon${stats.topCategory?`, with ${stats.topCategory.toLowerCase()} leading the list`:''}.`:`You’ve used ${stats.consumed} ${stats.consumed===1?'item':'items'} so far. Every one is a small win.`}</p></div></div>
    <div className="analytics-stats"><SummaryCard label="Food tracked now" value={foods.length} note="in your kitchen" icon={<Package size={18}/>} className="sum-green"/><SummaryCard label="Items consumed" value={stats.consumed} note="logged over time" icon={<Utensils size={18}/>} className="sum-sage"/><SummaryCard label="Past date" value={stats.expired} note="currently in inventory" icon={<TrendingDown size={18}/>} className="sum-coral"/><SummaryCard label="Used this month" value={stats.monthLogs} note="logged this month" icon={<Check size={18}/>} className="sum-amber"/></div>
    <div className="analytics-grid"><Panel className="chart-panel chart-wide"><div className="panel-heading"><div><span className="eyebrow">A LITTLE MOMENTUM</span><h2>Added & enjoyed</h2></div><span className="chart-legend"><i/> Added <i className="legend-use"/> Used</span></div><div className="chart-area"><ResponsiveContainer width="100%" height={245}><AreaChart data={stats.months} margin={{top:10,right:10,left:-20,bottom:0}}><defs><linearGradient id="addedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4b8064" stopOpacity={0.24}/><stop offset="95%" stopColor="#4b8064" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8e2d6"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#85877b',fontSize:12}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'#85877b',fontSize:12}}/><Tooltip/><Area type="monotone" dataKey="added" name="Added" stroke="#4b8064" fill="url(#addedFill)" strokeWidth={2.5}/><Area type="monotone" dataKey="used" name="Used" stroke="#dfad50" fill="transparent" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></Panel>
    <Panel className="chart-panel"><div className="panel-heading"><div><span className="eyebrow">WHAT’S IN THE MIX</span><h2>By category</h2></div></div>{stats.byCategory.length?<ResponsiveContainer width="100%" height={240}><BarChart data={stats.byCategory.slice(0,7)} layout="vertical" margin={{left:4,right:16,top:8,bottom:4}}><CartesianGrid horizontal={false} stroke="#e8e2d6"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'#85877b',fontSize:11}}/><YAxis type="category" dataKey="name" width={86} axisLine={false} tickLine={false} tick={{fill:'#656d63',fontSize:11}}/><Tooltip/><Bar dataKey="value" name="Items" fill="#4b8064" radius={[0,7,7,0]} barSize={13}/></BarChart></ResponsiveContainer>:<ChartEmpty/>}</Panel>
    <Panel className="chart-panel"><div className="panel-heading"><div><span className="eyebrow">A FRESHNESS SNAPSHOT</span><h2>Expiry outlook</h2></div></div>{stats.distribution.length?<div className="distribution-chart"><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={stats.distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={4}>{stats.distribution.map((_,i)=><Cell key={i} fill={['#72967c','#e3bb69','#df7861'][i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>:<ChartEmpty/>}<div className="expiry-legend">{stats.distribution.map((item,i)=><span key={item.name}><i style={{background:['#72967c','#e3bb69','#df7861'][i]}}/>{item.name}<b>{item.value}</b></span>)}</div></Panel>
    <Panel className="chart-panel consumption-panel"><div className="panel-heading"><div><span className="eyebrow">GOOD THINGS, USED UP</span><h2>Consumption over time</h2></div></div><div className="chart-area"><ResponsiveContainer width="100%" height={218}><BarChart data={stats.months} margin={{top:10,right:6,left:-22,bottom:0}}><CartesianGrid vertical={false} stroke="#e8e2d6"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#85877b',fontSize:12}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'#85877b',fontSize:12}}/><Tooltip/><Bar dataKey="used" name="Items enjoyed" fill="#d9aa50" radius={[6,6,0,0]} barSize={25}/></BarChart></ResponsiveContainer></div><p className="chart-footnote">Based on your logged consumption. No estimated costs, just real household habits.</p></Panel></div>
  </>}</AppShell>;
}
function ChartEmpty() { return <div className="chart-empty">Add a few food items to see this chart.</div>; }

const profileSchema=z.object({full_name:z.string().min(2,'Please enter your name.'),household_name:z.string().max(60,'Keep it under 60 characters.').optional()});
export function SettingsPage() {
  const {user}=useSession();
  const {data:profile,isLoading,isError,refetch}=useProfile();
  const writes=useFreshTrackWrites();
  const [enabled,setEnabled]=useState(true);
  const [days,setDays]=useState(3);
  const [theme,setTheme]=useState('light');
  useEffect(()=>{if(profile){setEnabled(profile.notification_enabled);setDays(profile.reminder_days_before)}},[profile]);
  useEffect(()=>{const saved=localStorage.getItem('freshtrack-theme')||'light';setTheme(saved)},[]);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>document.documentElement.classList.toggle('dark',theme==='dark'||(theme==='system'&&media.matches));
    apply();
    if(theme==='system'){media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)}
    return undefined;
  },[theme]);
  const saveSettings=async(nextEnabled=enabled,nextDays=days)=>{
    if(!user)return;
    try{await writes.saveProfile.mutateAsync({notification_enabled:nextEnabled,reminder_days_before:nextDays});toast.success('Reminder preferences saved.')}
    catch{toast.error('We couldn’t save your preferences. Please try again.')}
  };
  const chooseTheme=(value:string)=>{setTheme(value);localStorage.setItem('freshtrack-theme',value);toast.success('Appearance updated.')};
  return <AppShell><PageTitle eyebrow="MAKE IT WORK FOR YOU" title="Settings" description="A few small preferences for your household."/>{isLoading?<Panel><LoadingBlock rows={3}/></Panel>:isError?<ErrorBlock retry={()=>void refetch()}/>:<div className="settings-stack">
    <Panel className="settings-panel"><div className="settings-icon"><Bell size={19}/></div><div className="settings-copy"><span className="eyebrow">REMINDERS</span><h2>Helpful, never noisy.</h2><p>Choose whether you’d like FreshTrack to flag food that’s getting close.</p></div><div className="settings-control"><label className="switch-label"><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);void saveSettings(e.target.checked,days)}}/><span className="switch-track"/><span className="switch-caption">{enabled?'On':'Off'}</span></label></div><div className="settings-divider"/><div className="reminder-setting"><div><b>Remind me before food expires</b><small>We’ll check each item once and won’t send duplicates.</small></div><div className="reminder-options">{[1,2,3,5,7].map(n=><button key={n} className={days===n?'chosen':''} disabled={!enabled} onClick={()=>{setDays(n);void saveSettings(enabled,n)}} data-testid={`reminder-days-${n}`}>{n} day{n>1?'s':''}</button>)}</div></div></Panel>
    <Panel className="settings-panel appearance-panel"><div className="settings-icon settings-sun"><Sparkles size={18}/></div><div className="settings-copy"><span className="eyebrow">APPEARANCE</span><h2>Make yourself at home.</h2><p>Choose the look that feels right in your kitchen.</p></div><div className="theme-options" role="radiogroup" aria-label="Appearance">{['light','dark','system'].map(x=><button role="radio" aria-checked={theme===x} key={x} className={theme===x?'chosen':''} onClick={()=>chooseTheme(x)} data-testid={`theme-${x}`}><span className={`theme-preview theme-${x}`}><i/><i/><i/></span>{x[0].toUpperCase()+x.slice(1)}</button>)}</div></Panel>
    <Panel className="settings-footer"><div><ShieldCheck size={17}/><span><b>Your household’s food is private.</b><small>FreshTrack only accesses the data linked to your account.</small></span></div><Link href="/profile" className="panel-link">Profile details <ArrowRight size={15}/></Link></Panel>
  </div>}</AppShell>;
}

export function ProfilePage() {
  const {user}=useSession();
  const {data:profile,isLoading,isError,refetch}=useProfile();
  const writes=useFreshTrackWrites();
  const form=useForm<any>({resolver:zodResolver(profileSchema),defaultValues:{full_name:'',household_name:''}});
  useEffect(()=>{if(profile)form.reset({full_name:profile.full_name||'',household_name:profile.household_name||''})},[profile,form]);
  const submit=form.handleSubmit(async(values)=>{
    try{await writes.saveProfile.mutateAsync({full_name:values.full_name,household_name:values.household_name||null,email:user?.email||''});toast.success('Profile saved.')}
    catch{toast.error('We couldn’t save your profile. Please try again.')}
  });
  return <AppShell><PageTitle eyebrow="YOUR HOUSEHOLD" title="Profile" description="The details behind your FreshTrack kitchen."/>
    {isLoading?<Panel><LoadingBlock rows={3}/></Panel>:isError?<ErrorBlock retry={()=>void refetch()}/>:<div className="profile-layout"><Panel className="profile-card"><div className="profile-avatar">{(profile?.full_name||user?.email||'F').slice(0,1).toUpperCase()}</div><span className="eyebrow">ACCOUNT OWNER</span><h2>{profile?.full_name||'Your profile'}</h2><p>{user?.email}</p><div className="profile-private"><ShieldCheck size={16}/> Private to your account</div></Panel><Panel className="profile-form-panel"><div className="panel-heading"><div><span className="eyebrow">THE DETAILS</span><h2>Your profile</h2></div></div><form className="profile-form" onSubmit={submit}><Field label="Full name" error={form.formState.errors.full_name?.message}><input {...form.register('full_name')} data-testid="input-profile-name"/></Field><Field label="Email address"><input value={user?.email||''} readOnly aria-describedby="email-note" data-testid="input-profile-email"/></Field><small id="email-note" className="readonly-note">Your email is managed securely by your sign-in provider.</small><Field label="Household name" error={form.formState.errors.household_name?.message}><input placeholder="e.g. The Willow kitchen" {...form.register('household_name')} data-testid="input-household-name"/></Field><div className="form-actions"><Button type="submit" disabled={writes.saveProfile.isPending} data-testid="button-save-profile">{writes.saveProfile.isPending?'Saving…':'Save profile'} <Check size={16}/></Button></div></form></Panel></div>}</AppShell>;
}

export function NotFoundPage() {
  return <div className="not-found-page"><Link href="/" className="brand"><span className="brand-symbol"><Leaf size={20}/></span><span>freshtrack<span className="brand-period">.</span></span></Link><div className="not-found-art"><span>404</span><Leaf size={25}/></div><span className="eyebrow">NOT ON THE GROCERY LIST</span><h1>We can’t find<br/>that page.</h1><p>It may have moved, or maybe it was never on the list.</p><Link href="/dashboard" className="button button-primary">Back to your kitchen <ArrowRight size={16}/></Link></div>;
}

export { ConfigScreen };

