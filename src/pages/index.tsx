/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 * Keep it renderable without a browser: no window/document during render.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const STEPS = [
  {
    title: 'Open a table',
    body: 'Name the occasion, add a budget or neighborhood if you care, and share one link with the group.',
  },
  {
    title: 'Nominate & vote',
    body: 'Everyone drops in restaurant ideas and votes yes or no. Tallies update live — no more 47-message threads.',
  },
  {
    title: 'Let the host call it',
    body: 'The AI host reads the votes and your constraints, breaks ties, and locks in a winner everyone can live with.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">{APP_NAME}</p>
          <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            “Where should we eat?” — decided.
          </h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            DecidEat gives your group one table to decide at: nominate restaurants,
            vote in real time, and let the AI host call the winner. Dinner plans in
            minutes, not group-chat hours.
          </p>
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter the app
          </Link>

          <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  Step {i + 1}
                </p>
                <h2 className="mb-1 text-base font-semibold">{step.title}</h2>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </main>
        <footer className="px-6 pb-8 text-center text-xs text-muted-foreground">
          Built for groups who would rather be eating than deciding.
        </footer>
      </div>
    </>
  )
}
