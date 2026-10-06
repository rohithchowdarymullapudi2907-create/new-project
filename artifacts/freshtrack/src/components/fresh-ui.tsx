import { Link, useLocation } from 'wouter';
import { useState, type ReactNode } from 'react';
import { Bell, ChevronDown, CircleHelp, Home, Leaf, LogOut, Menu, Package, Plus, Settings, Sparkles, X, ChartNoAxesColumn, UserRound, CalendarClock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useNotifications, useProfile } from '@/hooks/use-freshtrack';

export function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'outline'|'quiet'|'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}
export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>;
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const names: Record<string,string> = { expired:'Expired', today:'Expires today', soon:'Expiring soon', fresh:'Fresh' };
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{label ?? names[status] ?? status}</span>;
}
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-list" aria-label="Loading"><span className="sr-only">Loading content</span>{Array.from({ length: rows }, (_, i) => <div className="skeleton-row" key={i}><i /><span><b /><b /></span><em /></div>)}</div>;
}
export function ErrorBlock({ retry }: { retry?: () => void }) {
  return <div className="state-box"><div className="state-mark"><CircleHelp size={23} /></div><h3>We couldn't load this just now</h3><p>Check your connection, then give it another try.</p>{retry && <Button variant="outline" onClick={retry}>Try again</Button>}</div>;
}
export function EmptyBlock({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="state-box"><div className="state-mark"><Leaf size={23} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function AppShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: notes = [] } = useNotifications();
  const unread = notes.filter((n: any) => !n.is_read).length;
  const nav = [
    { href:'/dashboard', title:'Overview', icon:Home },
    { href:'/inventory', title:'My inventory', icon:Package },
    { href:'/expiring', title:'Eat these first', icon:CalendarClock },
    { href:'/notifications', title:'Reminders', icon:Bell, count:unread },
    { href:'/analytics', title:'Food insights', icon:ChartNoAxesColumn },
  ];
  const signOut = async () => { await supabase?.auth.signOut(); };
  const sidebar = <><Link href="/dashboard" className="brand" onClick={() => setMobileOpen(false)}><span className="brand-symbol"><Leaf size={20} /></span><span>freshtrack<span className="brand-period">.</span></span></Link>
    <div className="sidebar-caption">YOUR KITCHEN</div><nav className="side-nav" aria-label="Main navigation">{nav.map(({href,title,icon:Icon,count}) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`side-link ${path === href ? 'selected' : ''}`} data-testid={`nav-${title.toLowerCase().replaceAll(' ','-')}`}><Icon size={18}/><span>{title}</span>{count ? <b className="nav-count">{count}</b> : null}</Link>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={16}/><p><strong>A little less waste.</strong><br/>A lot more good meals.</p></div><Link href="/settings" className={`side-link ${path === '/settings' ? 'selected' : ''}`}><Settings size={18}/><span>Settings</span></Link><Link href="/profile" className={`side-link ${path === '/profile' ? 'selected' : ''}`}><UserRound size={18}/><span>Profile</span></Link><button className="account-row" onClick={signOut} data-testid="button-sign-out"><span className="avatar">{(profile?.full_name || user?.email || 'F').slice(0,1).toUpperCase()}</span><span className="account-copy"><b>{profile?.full_name || 'Your account'}</b><small>Sign out</small></span><LogOut size={16}/></button></div>
  </>;
  return <div className="app-shell"><aside className="sidebar">{sidebar}</aside>{mobileOpen && <div className="mobile-sidebar-overlay" onClick={() => setMobileOpen(false)}><aside className="sidebar mobile-sidebar" onClick={e => e.stopPropagation()}><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X/></button>{sidebar}</aside></div>}
    <main className="app-main"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu/></button><div className="breadcrumb"><span>FreshTrack</span><span className="crumb-slash">/</span><b>{nav.find(n=>n.href===path)?.title ?? (path.includes('inventory')?'Inventory':path.replace('/','').replace(/^\w/,x=>x.toUpperCase()))}</b></div><div className="topbar-right"><Link href="/notifications" className="top-icon" aria-label={`Notifications, ${unread} unread`} data-testid="link-notifications"><Bell size={19}/>{unread > 0 && <i>{unread}</i>}</Link><Link href="/settings" className="top-household"><span className="household-mark"><Leaf size={14}/></span>{profile?.household_name || 'Our kitchen'}<ChevronDown size={14}/></Link></div></header><div className="page-wrap">{children}</div></main>
  </div>;
}

