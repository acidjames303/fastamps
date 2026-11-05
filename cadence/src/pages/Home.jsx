import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, MessageSquare, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/lib/utils';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">AI-Powered Communication Intelligence</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight text-white md:text-7xl">
            Cadence: Know When to Meet, Message, or Email
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-300">
            The fastest way to align your team: clear recommendations, optimized meetings, and ready-to-use communication drafts.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link to={createPageUrl('NewDecision')}>
              <Button size="lg" className="bg-blue-600 px-8 py-6 text-lg text-white hover:bg-blue-700">
                <Sparkles className="mr-2 h-5 w-5" />
                Find Your Cadence
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to={createPageUrl('History')}>
              <Button size="lg" variant="outline" className="border-slate-600 bg-transparent px-8 py-6 text-lg text-white hover:bg-slate-800">
                View History
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">Smart Meeting Recommendations</h3>
              <p className="text-slate-400">
                Get data-driven recommendations on when meetings are necessary, with auto-generated agendas and optimal participant lists.
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <Mail className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">AI-Drafted Emails</h3>
              <p className="text-slate-400">
                Instantly generate professional emails with the right tone, structure, and calls-to-action based on your communication goals.
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10">
                <MessageSquare className="h-6 w-6 text-violet-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">Async-First Updates</h3>
              <p className="text-slate-400">
                Know when async channels are enough — and leave the meeting calendar for decisions that actually need the room.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
