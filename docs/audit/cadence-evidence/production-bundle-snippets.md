# Cadence production bundle snippets

Source: `https://cadence.base44.app/assets/index-BQoHtkdm.js` (5 Nov 2026)

### pages-map (offset 647160)
```
on-support for leaders."})})})]})}const R5={NewDecision:w3,History:P5,Home:N5},BE={mainPage:"Home",Pages:R5,Layout:_5};function j5(){const e=vo(),{isAuthenticated:t}=R1(),{Pages:n,mainPage:r}=BE,o=r;return E.useEffect(()=>{var l;(l=window.parent)==null||l.postMessage({type:"app_changed_url",url:window.location.href},"*")},[e]),E.useEffect(()=>{const l=e.pathname;let c;if(l==="/"||l==="")c=o;else{const u=l.replace(/^\//,"").split("/")[0];c=Object.keys(n).find(g=>g.toLowerCase()===u.toLowerCase())||null}t&&c&&Yt.appLogs.logUserInApp(c).
```

### decision-engine-rules (offset 593193)
```
etingScore:n,emailScore:r,asyncScore:o}}static applyDecisionRules(t,n){const{meetingScore:r,emailScore:o,asyncScore:l}=t,c=Math.max(r,o,l);let u,f=[];r===c?(u="meeting",(n.urgency==="critical"||n.urgency==="high")&&f.push("High urgency requires real-time discussion"),(n.complexity==="highly_complex"||n.complexity==="complex")&&f.push("Complex topics benefit from interactive dialogue"),n.emotional_risk==="high"&&f.push("Sensitive content needs nuanced, face-to-face communication"),(Array.isArray(n.decision_type)?n.decision_type:[n.deci
```

### score-inputs (offset 592839)
```
inform"?r+=20:c==="update"&&(o+=20)}),t.stakeholder_count==="10+"?n+=10:t.stakeholder_count==="6-10"?n+=5:t.stakeholder_count==="3-5"?n+=10:r+=15,t.emotional_risk==="high"?n+=25:t.emotional_risk==="medium"?n+=15:t.emotional_risk==="low"&&(r+=10),t.change_impact==="high"?n+=20:t.change_impact==="medium"?n+=10:r+=10,t.cross_team_dependencies&&(n+=15),{meetingScore:n,emailScore:r,asyncScore:o}}static applyDecisionRules(t,n){const{meetingScore:r,emailScore:o,asyncScore:l}=t,c=Math.max(r,o,l);let u,f=[];r===c?(u="meeting",(n.urgency==="cri
```

### invoke-llm-meeting (offset 600406)
```
hip-ready`,R=await Yt.integrations.Core.InvokeLLM({prompt:P});b.generated_agenda=R}else if(S.recommendation==="email"){const P=`Draft a professional, action-oriented email for a leader.

Context:
Topic: ${x.title}
Purpose: ${x.purpose}
Recipients: ${x.stakeholder_groups||"Team"}
Urgency: ${x.urgency}
Decision Needed: ${Array.isArray(x.decision_type)?x.decision_type.join(", "):x.decision_type}
Communication Style: ${x.communication_style}
Timeline: ${x.time_sensitivity||"At your earliest convenience"}

Format with sentence case and cle
```

### entity-ops (offset 625197)
```
sions-metrics"],queryFn:()=>Yt.entities.CommunicationDecision.list("-created_date",200)}),n=new Date,r=new Date(n.getFullYear(),n.getMonth(),n.getDate()-n.getDay()),o=new Date(n.getFullYear(),n.getMonth(),1),c=(()=>{const f=t.filter(N=>new Date(N.created_date)>=r),h=t.filter(N=>new Date(N.created_date)>=o),g=t.reduce((N,P)=>N+(P.time_saved_minutes||0),0),y=f.reduce((N,P)=>N+(P.time_saved_minutes||0),0),w=h.reduce((N,P)=>N+(P.time_saved_minutes||0),0),x=t.filter(N=>N.recommendation==="email"||N.recommendation==="async_message").length,
```

### home-hero (offset 638297)
```
ext-white mb-6 leading-tight",children:"Cadence: Know When to Meet, Message, or Email"}),p.jsx("p",{className:"text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed",children:"The fastest way to align your team: clear recommendations, optimized meetings, and ready-to-use communication drafts."}),p.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 justify-center",children:[p.jsx(ds,{to:hs("NewDecision"),children:p.jsxs(rt,{size:"lg",className:"bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg",children:[p.jsx(Sn,
```
