/* ---------- 第六步：成长闭环（工作台 / 驿站 / 档案墙 / 经验域） ---------- */
(function(){
  var R=document.getElementById("yutu2");
  if(!R) return;
  var Q=function(id){return R.querySelector("#"+id);};
  var A=window.__YUTU_LOOP__;   /* 由主脚本注入的共享引用 */
  if(!A) return;

  var STATUS={doing:"进行中",done:"已完成",hold:"暂时搁置",drop:"选择放弃"};
  var CHOICE={keep:"维持方向",revise:"修改计划",rest:"暂时休整",switch:"更换方向"};
  var DRIFT={keep:{history:4,inertia:1},revise:{history:4,inertia:3},
             rest:{history:2,econ:-2},switch:{history:5,inertia:6,cycle:2}};
  var NEED=3;
  var PEERS=[
    {who:"同处境者 · 川内专科 2024 届",kind:"亲历记述",marks:7,
     text:"我也是土木专科，先去工地待了一个暑假才确定不适合。这个暑假没白花——它把一条路彻底排除了，后面选造价时就不再犹豫。"},
    {who:"同处境者 · 二线在职转行",kind:"亲历记述",marks:12,
     text:"不离职做验证这件事，最大的难点不是时间而是情绪。建议把验证窗口写死在日历上，到期就出结论，否则会无限期拖延。"},
    {who:"行业共识",kind:"行业共识",marks:9,
     text:"造价与施工的起薪差距在前两年并不明显，差异主要体现在工作地点稳定性与加班强度上。"},
    {who:"同处境者 · 县域体制内",kind:"个人推测",marks:3,
     text:"我的判断是远程岗位对本地身份的要求在变低，但这只是我的观察，没有数据支撑。"}
  ];

  function fmtTime(d){
    var p=function(n){return n<10?"0"+n:""+n;};
    return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+
           " "+p(d.getHours())+":"+p(d.getMinutes());
  }
  function flash(id,msg){
    var el=Q(id); if(!el) return;
    el.textContent=msg||"";
    if(!msg) return;
    var tk=(el.__t||0)+1; el.__t=tk;
    setTimeout(function(){ if(el.__t===tk) el.textContent=""; },4200);
  }

  /* ---- 工作台 ---- */
  function syncLoadedNode(){
    if(!A.ST.loadedNode) return;
    var still=A.ST.tasks.some(function(t){ return t.node===A.ST.loadedNode; });
    if(!still) A.ST.loadedNode=null;
  }
  function loadTasks(node){
    var added=0;
    (node.tasks||[]).forEach(function(t){
      if(A.ST.tasks.some(function(x){return x.src===t.id;})) return;
      A.ST.seq+=1;
      A.ST.tasks.push({id:"k"+A.ST.seq,src:t.id,node:node.id,nodeName:node.name,
        type:t.type,title:t.title,origin:t.src,pre:t.pre,risk:t.risk,std:t.std,
        status:"doing",custom:false,archived:false});
      added+=1;
    });
    A.ST.loadedNode=node.id;
    return added;
  }
  function visibleTasks(){
    return A.ST.tasks.filter(function(t){
      return A.ST.filter==="all"||t.status===A.ST.filter;
    });
  }
  function archivable(){
    return A.ST.tasks.filter(function(t){ return t.status==="done"&&!t.archived; });
  }

  function renderTasks(){
    var box=Q("y-tasks"); if(!box) return;
    var vis=visibleTasks();
    box.textContent="";
    var doing=A.ST.tasks.filter(function(t){return t.status==="doing";}).length;
    var done=A.ST.tasks.filter(function(t){return t.status==="done";}).length;
    var chip=Q("y-count-chip");
    if(chip) chip.textContent="共 "+A.ST.tasks.length+" 项 ｜ 进行中 "+doing+" ｜ 已完成 "+done+
      (A.ST.filter==="all"?"":" ｜ 当前筛选 "+vis.length+" 项");
    var f1=Q("y-flag-bench"); if(f1) f1.textContent=String(doing);

    if(!A.ST.tasks.length){
      var e=document.createElement("div"); e.className="y-empty";
      e.textContent="清单还是空的。点「从当前域载入参考任务」，或直接新增一条自定义任务。";
      box.appendChild(e); return;
    }
    if(!vis.length){
      var e2=document.createElement("div"); e2.className="y-empty";
      var p=document.createElement("p");
      p.textContent="当前筛选条件下没有任务，共有 "+A.ST.tasks.length+" 项被隐藏。";
      var b=document.createElement("button");
      b.type="button"; b.className="y-btn y-btn-s"; b.style.marginTop="9px";
      b.textContent="清除筛选";
      b.addEventListener("click",function(){
        A.ST.filter="all"; var sel=Q("y-filter"); if(sel) sel.value="all"; renderTasks();
      });
      e2.appendChild(p); e2.appendChild(b); box.appendChild(e2); return;
    }

    vis.forEach(function(t){
      var card=document.createElement("div");
      card.className="y-task"+(t.status==="hold"?" is-hold":"")+(t.status==="drop"?" is-drop":"");
      var top=document.createElement("div"); top.className="y-task-top";
      var left=document.createElement("div"); left.style.minWidth="0";
      var ttl=document.createElement("p"); ttl.className="y-task-ttl"; ttl.textContent=t.title;
      left.appendChild(ttl);
      var tags=document.createElement("div"); tags.style.marginTop="4px";
      [[t.type,"y-chip-b"],[STATUS[t.status],""]].forEach(function(c){
        var sp=document.createElement("span"); sp.className="y-chip "+c[1];
        sp.textContent=c[0]; tags.appendChild(sp);
      });
      if(t.custom){ var c3=document.createElement("span"); c3.className="y-chip y-chip-c";
        c3.textContent="自定义"; tags.appendChild(c3); }
      if(t.archived){ var c4=document.createElement("span"); c4.className="y-chip y-chip-w";
        c4.textContent="已归档"; tags.appendChild(c4); }
      left.appendChild(tags);
      var meta=document.createElement("p"); meta.className="y-task-meta";
      [["经验出处",t.origin],["前置条件",t.pre],["风险提示",t.risk],["完成标准",t.std]]
        .forEach(function(r){
          if(!r[1]||r[1]==="—") return;
          if(meta.childNodes.length) meta.appendChild(document.createElement("br"));
          var b=document.createElement("b"); b.textContent=r[0]+"：";
          meta.appendChild(b); meta.appendChild(document.createTextNode(r[1]));
        });
      left.appendChild(meta);
      top.appendChild(left);

      var act=document.createElement("div"); act.className="y-task-act";
      var sel=document.createElement("select");
      sel.setAttribute("aria-label","任务状态："+t.title);
      Object.keys(STATUS).forEach(function(k){
        var o=document.createElement("option"); o.value=k; o.textContent=STATUS[k];
        if(t.status===k) o.selected=true;
        sel.appendChild(o);
      });
      sel.disabled=t.archived;
      sel.addEventListener("change",function(){
        t.status=sel.value;
        var hidden=A.ST.filter!=="all"&&t.status!==A.ST.filter;
        renderTasks(); renderStopList(); renderDrift(); renderLoopState();
        flash("y-bench-flash", hidden
          ? "已保存为「"+STATUS[t.status]+"」，但当前筛选条件下不显示该任务。"
          : "已更新为「"+STATUS[t.status]+"」。"+(t.status==="done"?"可以去驿站停靠了。":""));
      });
      act.appendChild(sel);
      var del=document.createElement("button");
      del.type="button"; del.className="y-btn y-btn-s"; del.textContent="移除";
      del.setAttribute("aria-label","移除任务："+t.title);
      del.disabled=t.archived;
      del.addEventListener("click",function(){
        A.ST.tasks=A.ST.tasks.filter(function(x){return x.id!==t.id;});
        syncLoadedNode();
        renderTasks(); renderStopList(); renderDrift(); renderLoopState();
        flash("y-bench-flash","已移除「"+t.title.slice(0,14)+"…」。不适用的任务可以直接删掉。");
      });
      act.appendChild(del);
      top.appendChild(act);
      card.appendChild(top);
      box.appendChild(card);
    });
  }

  /* ---- 停靠驿站 ---- */
  function nextChoice(){
    var el=R.querySelector('input[name="y-next"]:checked');
    return el?el.value:"keep";
  }
  function renderStopCtx(){
    var box=Q("y-stop-ctx"); if(!box) return;
    box.textContent="";
    var NS="http://www.w3.org/2000/svg";
    var svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox","0 0 24 24"); svg.setAttribute("aria-hidden","true");
    function mk(t,a){ var e=document.createElementNS(NS,t);
      for(var k in a) e.setAttribute(k,a[k]); return e; }
    svg.appendChild(mk("circle",{cx:12,cy:12,r:11,fill:"#fff",stroke:"#1f6fb2"}));
    svg.appendChild(mk("ellipse",{cx:9,cy:11,rx:1.7,ry:2,fill:"#1f6fb2"}));
    svg.appendChild(mk("ellipse",{cx:15,cy:11,rx:1.7,ry:2,fill:"#1f6fb2"}));
    svg.appendChild(mk("ellipse",{cx:12,cy:16,rx:2.2,ry:1.6,fill:"none",stroke:"#1f6fb2"}));
    box.appendChild(svg);
    var span=document.createElement("span");
    var cur=A.current();
    span.textContent="先回到你出发时的处境：经济压力 "+A.ST.s.econ+"，家庭负担 "+A.ST.s.family+
      "，年龄 "+A.ST.s.age+" 岁，当时归属「"+cur.node.name.split(" · ")[0]+"」。现在变了没有？";
    box.appendChild(span);
  }
  function renderStopList(){
    var box=Q("y-stop-list"); if(!box) return;
    box.textContent="";
    var arr=archivable();
    if(!arr.length){
      var e=document.createElement("div"); e.className="y-empty";
      e.textContent="还没有标记为「已完成」的体验。驿站不催促——等真的完成一段再回来。";
      box.appendChild(e);
    }else{
      arr.forEach(function(t){
        var row=document.createElement("div"); row.className="y-pool";
        var s=document.createElement("strong"); s.style.fontSize="13px"; s.textContent=t.title;
        row.appendChild(s);
        var m=document.createElement("p"); m.className="y-vic-body";
        m.textContent=t.type+" ｜ 完成标准："+t.std;
        row.appendChild(m);
        box.appendChild(row);
      });
    }
    var btn=Q("y-archive");
    if(btn) btn.disabled=!arr.length;
  }
  function renderDrift(){
    var box=Q("y-drift"); if(!box) return;
    box.textContent="";
    var d=DRIFT[nextChoice()], n=archivable().length, any=false;
    A.DIMS.forEach(function(dim){
      var base=d[dim.k]; if(!base) return;
      any=true;
      var cur=A.ST.s[dim.k], next=n?A.clampDim(dim,cur+base):cur;
      var li=document.createElement("li");
      var b=document.createElement("b"); b.textContent=dim.n;
      var s=document.createElement("span");
      if(!n){
        s.textContent="+"+base+"（需先有可归档的体验）";
      }else if(next===cur){
        s.textContent=(base>0?"+":"")+base+"（当前 "+cur+"，已达"+(base>0?"上":"下")+"限 "+
          (base>0?dim.max:dim.min)+"，本次不再变化）";
      }else{
        s.textContent=(base>0?"+":"")+base+"（当前 "+cur+" → "+next+"）";
      }
      li.appendChild(b); li.appendChild(s); box.appendChild(li);
    });
    if(!any||!n){
      var li2=document.createElement("li");
      var b2=document.createElement("b"); b2.textContent="说明";
      var s2=document.createElement("span");
      s2.textContent=n?"该选项不改变向量，只记录判断。":"没有可归档的体验时不产生漂移。";
      li2.appendChild(b2); li2.appendChild(s2); box.appendChild(li2);
    }
  }

  /* ---- 归档：闭环的关键一环 ---- */
  function archive(){
    var arr=archivable();
    if(!arr.length){ flash("y-stop-flash","还没有已完成的体验可以归档。"); return; }
    var choice=nextChoice();
    var snap={}; A.DIMS.forEach(function(d){ snap[d.k]=A.ST.s[d.k]; });
    var cur=A.current();
    var answers={
      feel:(Q("y-q1").value||"").trim(),
      ctx:(Q("y-q2").value||"").trim(),
      vision:(Q("y-q3").value||"").trim()
    };
    A.ST.seq+=1;
    A.ST.victories.push({
      id:"v"+A.ST.seq, no:A.ST.victories.length+1, at:fmtTime(new Date()),
      snap:snap, domain:cur.node.name, sim:cur.sim,
      tasks:arr.map(function(t){return {title:t.title,type:t.type};}),
      choice:choice, answers:answers
    });
    arr.forEach(function(t){ t.archived=true; });

    /* 向量小幅漂移：位置因此成为动态的 */
    var d=DRIFT[choice];
    A.DIMS.forEach(function(dim){
      if(d[dim.k]) A.ST.s[dim.k]=A.clampDim(dim,A.ST.s[dim.k]+d[dim.k]);
    });
    /* 年龄随时间平滑漂移 */
    var ageDim=A.DIMS.filter(function(x){return x.k==="age";})[0];
    A.ST.s.age=A.clampDim(ageDim,A.ST.s.age+(A.ST.victories.length%3===0?1:0));

    ["y-q1","y-q2","y-q3"].forEach(function(id){ var el=Q(id); if(el) el.value=""; });

    /* 回流到前面的步骤：滑块、地球、方向、态势、沃罗诺伊全部跟着更新 */
    A.refreshAll();
    renderAll();

    var msg="第 "+A.ST.victories.length+" 次阶段性胜利已归档";
    if(choice==="rest") msg+="。选择了暂时休整，系统不推送新任务，只确认记录已存档。";
    else if(choice==="switch") msg+="。排除一条路线同样是胜利——它以可控成本换来了清晰结论。";
    else msg+="。位置已小幅漂移，回到第 2 步地图可以看到新的落点。";
    flash("y-stop-flash",msg);
  }

  /* ---- 胜利档案墙 ---- */
  function miniMap(snap){
    var NS="http://www.w3.org/2000/svg";
    function mk(t,a){ var e=document.createElementNS(NS,t);
      for(var k in a) e.setAttribute(k,a[k]); return e; }
    var svg=mk("svg",{viewBox:"0 0 260 190",role:"img",
      "aria-label":"二维投影小地图：横轴资源余量，纵轴探索倾向，蓝点为该时间点的位置"});
    svg.appendChild(mk("rect",{x:0,y:0,width:260,height:190,fill:"#fffefb"}));
    for(var x=26;x<=246;x+=27.5)
      svg.appendChild(mk("line",{x1:x,y1:12,x2:x,y2:176,stroke:"#f1eee7","stroke-width":1}));
    for(var y=12;y<=176;y+=27.3)
      svg.appendChild(mk("line",{x1:26,y1:y,x2:246,y2:y,stroke:"#f1eee7","stroke-width":1}));
    var sc=function(p){ return {x:26+(p.x-30)/460*220, y:12+(p.y-32)/316*164}; };
    var best=A.nearestNode(snap);
    A.NODES.forEach(function(n){
      if(n.own) return;
      var p=sc(A.proj(n.s));
      svg.appendChild(mk("circle",{cx:p.x,cy:p.y,r:n.id===best.node.id?5:3.2,
        fill:n.id===best.node.id?"#23221f":"#cfc8bb"}));
    });
    var m=sc(A.proj(snap));
    svg.appendChild(mk("circle",{cx:m.x,cy:m.y,r:8,fill:"#1f6fb2",opacity:.18}));
    svg.appendChild(mk("circle",{cx:m.x,cy:m.y,r:4,fill:"#1f6fb2",
      stroke:"#fffefb","stroke-width":1.5}));
    /* 与第五步沃罗诺伊同一套坐标，标出两轴以免小图失去量纲 */
    /* 刻度：与第五步沃罗诺伊同一量纲 0–100，避免小图失去量级参照 */
    [0,50,100].forEach(function(v){
      var px=26+v/100*220, py=176-v/100*164;
      var tx=mk("text",{x:px,y:186,"text-anchor":v===0?"start":(v===100?"end":"middle"),
        "font-size":8.5,fill:"#aba79e"});
      tx.textContent=v; svg.appendChild(tx);
      var ty=mk("text",{x:23,y:py+3,"text-anchor":"end","font-size":8.5,fill:"#aba79e"});
      ty.textContent=v; svg.appendChild(ty);
    });
    var ax=mk("text",{x:246,y:9,"text-anchor":"end","font-size":9.5,fill:"#8d887e"});
    ax.textContent="横轴 资源余量 ／ 纵轴 探索倾向"; svg.appendChild(ax);
    return {svg:svg,domain:best.node.name};
  }

  function renderWall(){
    var box=Q("y-wall"); if(!box) return;
    box.textContent="";
    var f=Q("y-flag-wall"); if(f) f.textContent=String(A.ST.victories.length);
    var f2=Q("y-flag-loop"); if(f2) f2.textContent=String(A.ST.victories.length);
    if(!A.ST.victories.length){
      var e=document.createElement("div"); e.className="y-empty";
      e.textContent="档案墙还是空的。完成一段体验、在驿站做完反思之后，第一次阶段性胜利就会出现在这里。";
      box.appendChild(e); return;
    }
    A.ST.victories.slice().reverse().forEach(function(v){
      var card=document.createElement("div"); card.className="y-vic";
      var top=document.createElement("div"); top.className="y-vic-top";
      var t=document.createElement("strong"); t.style.fontSize="13.5px";
      t.textContent="第 "+v.no+" 次阶段性胜利 · "+CHOICE[v.choice];
      var ts=document.createElement("span"); ts.className="y-vic-ts"; ts.textContent=v.at;
      top.appendChild(t); top.appendChild(ts); card.appendChild(top);
      var tags=document.createElement("div"); tags.style.margin="5px 0 2px";
      v.tasks.forEach(function(x){
        var c=document.createElement("span"); c.className="y-chip y-chip-b";
        c.textContent=x.type; tags.appendChild(c);
      });
      var cd=document.createElement("span"); cd.className="y-chip";
      cd.textContent=v.domain.split(" · ")[0]; tags.appendChild(cd);
      card.appendChild(tags);
      var body=document.createElement("p"); body.className="y-vic-body";
      body.textContent="完成体验："+v.tasks.map(function(x){return x.title;}).join("；");
      card.appendChild(body);
      var ref=document.createElement("p"); ref.className="y-vic-body";
      var parts=[];
      if(v.answers.feel) parts.push("真实感受："+v.answers.feel);
      if(v.answers.ctx) parts.push("处境变化："+v.answers.ctx);
      if(v.answers.vision) parts.push("愿景："+v.answers.vision);
      if(parts.length){ ref.textContent="自省原文 — "+parts.join(" ／ "); }
      else { ref.textContent="自省原文 — 本次未填写文字，仅记录了下一步选择。";
             ref.style.color="var(--y-muted)"; }
      card.appendChild(ref);
      var sn=document.createElement("p"); sn.className="y-vic-body";
      sn.style.color="var(--y-muted)";
      sn.textContent="向量快照 — "+A.DIMS.map(function(d){
        return d.n+" "+v.snap[d.k];
      }).join("，");
      card.appendChild(sn);
      box.appendChild(card);
    });
  }

  function snapOptions(){
    var opts=A.ST.victories.map(function(v){
      return {id:v.id,label:"第 "+v.no+" 次胜利（"+v.at.slice(0,10)+"）",snap:v.snap};
    });
    opts.push({id:"now",label:"当前位置",snap:A.ST.s});
    return opts;
  }
  function renderCompare(){
    var a=Q("y-cmp-a"), b=Q("y-cmp-b"), box=Q("y-cmp"), diff=Q("y-cmp-diff");
    if(!a||!b||!box) return;
    var opts=snapOptions();
    var prevA=a.value, prevB=b.value;
    function fill(sel,keep){
      sel.textContent="";
      opts.forEach(function(o){
        var el=document.createElement("option"); el.value=o.id; el.textContent=o.label;
        sel.appendChild(el);
      });
      if(keep&&opts.some(function(o){return o.id===keep;})) sel.value=keep;
    }
    fill(a,prevA); fill(b,prevB);
    if(!prevA) a.value=opts[0].id;
    if(!prevB) b.value=opts[opts.length-1].id;
    if(a.value===b.value&&opts.length>1){
      b.value=opts[opts.length-1].id;
      if(a.value===b.value) a.value=opts[0].id;
    }
    var oa=opts.filter(function(o){return o.id===a.value;})[0]||opts[0];
    var ob=opts.filter(function(o){return o.id===b.value;})[0]||opts[opts.length-1];

    box.textContent="";
    [[oa,"起点"],[ob,"终点"]].forEach(function(pair){
      var fig=document.createElement("figure");
      var m=miniMap(pair[0].snap);
      fig.appendChild(m.svg);
      var cap=document.createElement("figcaption");
      var lb=document.createElement("b"); lb.textContent=pair[1]+"：" +pair[0].label;
      cap.appendChild(lb);
      cap.appendChild(document.createTextNode("归属 "+m.domain.split(" · ")[0]));
      fig.appendChild(cap);
      box.appendChild(fig);
    });

    diff.textContent="";
    function row(k,v){
      var li=document.createElement("li");
      var b2=document.createElement("b"); b2.textContent=k;
      var s=document.createElement("span"); s.textContent=v;
      li.appendChild(b2); li.appendChild(s); diff.appendChild(li);
    }
    if(oa.id===ob.id){ row("提示","起点与终点相同，暂无可比较的变化。"); return; }
    var moved=false;
    A.DIMS.forEach(function(d){
      var va=oa.snap[d.k], vb=ob.snap[d.k];
      if(va===vb) return;
      moved=true;
      row(d.n, va+" → "+vb+"（"+(vb>va?"+":"")+(vb-va)+(d.unit||"")+"）");
    });
    if(!moved) row("变化","两个时间点的向量完全一致。");
  }

  /* ---- 同伴经验域：外层共建闭环 ---- */
  function renderPool(){
    var box=Q("y-pool"); if(!box) return;
    box.textContent="";
    var unsub=A.ST.victories.filter(function(v){
      return !A.ST.pool.some(function(p){return p.vid===v.id;});
    });
    if(!A.ST.victories.length){
      var e=document.createElement("div"); e.className="y-empty";
      e.textContent="还没有可提交的复盘。先在驿站归档一次阶段性胜利。";
      box.appendChild(e);
    }
    unsub.forEach(function(v){
      /* 质量门槛：无有效自省内容的记录不进入校验池 */
      var filled=[v.answers.feel,v.answers.ctx,v.answers.vision]
        .filter(function(x){ return x&&x.length>=8; }).length;
      var ok=filled>0;
      var card=document.createElement("div"); card.className="y-pool";
      var top=document.createElement("div"); top.className="y-vic-top";
      var t=document.createElement("strong"); t.style.fontSize="13px";
      t.textContent="第 "+v.no+" 次胜利 · "+CHOICE[v.choice];
      var c=document.createElement("span");
      c.className="y-chip"+(ok?"":" y-chip-w");
      c.textContent=ok?"尚未提交":"内容不足，不可提交";
      top.appendChild(t); top.appendChild(c); card.appendChild(top);
      var p=document.createElement("p"); p.className="y-vic-body";
      p.textContent=ok
        ? "提交后以处境区间呈现，不包含精确个人数据；初始仅本人可见。"
        : "这次停靠没有留下自省文字。无有效内容的记录不进入校验池——回驿站补写后即可提交。";
      card.appendChild(p);
      var row=document.createElement("div"); row.className="y-row"; row.style.marginTop="7px";
      var btn=document.createElement("button");
      btn.type="button"; btn.className="y-btn y-btn-s"; btn.textContent="提交到校验池";
      btn.disabled=!ok;
      btn.addEventListener("click",function(){
        if(!ok) return;
        A.ST.pool.push({vid:v.id,no:v.no,choice:v.choice,marks:0,public:false,domain:v.domain});
        renderPool();
        flash("y-peer-flash","已提交。当前仅本人可见，需 "+NEED+" 位同处境用户标记有效后升级为公共节点。");
      });
      row.appendChild(btn); card.appendChild(row);
      box.appendChild(card);
    });

    A.ST.pool.forEach(function(p){
      var card=document.createElement("div"); card.className="y-pool";
      var top=document.createElement("div"); top.className="y-vic-top";
      var t=document.createElement("strong"); t.style.fontSize="13px";
      t.textContent="第 "+p.no+" 次胜利 · "+CHOICE[p.choice];
      var c=document.createElement("span");
      c.className="y-chip "+(p.public?"y-chip-c":"y-chip-b");
      c.textContent=p.public?"已升级为公共节点":"仅本人可见";
      top.appendChild(t); top.appendChild(c); card.appendChild(top);
      var meter=document.createElement("div"); meter.className="y-meter";
      var fill=document.createElement("i");
      fill.style.width=Math.min(100,p.marks/NEED*100)+"%";
      meter.appendChild(fill); card.appendChild(meter);
      var info=document.createElement("p"); info.className="y-vic-body";
      info.textContent=p.public
        ? "影响力：已被 "+(p.marks+4)+" 位处境相近的用户参考，其中 "+p.marks+
          " 人标记有用。该节点对他人可见，不参与你自己的归属计算。"
        : "有效标记 "+p.marks+" / "+NEED+"。无有效内容的记录不进入校验池。";
      card.appendChild(info);
      if(!p.public){
        var row=document.createElement("div"); row.className="y-row"; row.style.marginTop="6px";
        var btn=document.createElement("button");
        btn.type="button"; btn.className="y-btn y-btn-s";
        btn.textContent="模拟一位同处境用户标记有效";
        btn.addEventListener("click",function(){
          p.marks+=1;
          if(p.marks>=NEED){
            p.public=true;
            var src=A.ST.victories.filter(function(v){return v.id===p.vid;})[0];
            if(src&&!A.NODES.some(function(n){return n.id==="u"+p.vid;})){
              A.NODES.push({
                id:"u"+p.vid, name:"用户贡献 · 第 "+p.no+" 次胜利复盘", hue:"#4f7a58", own:true,
                s:(function(){var o={};A.DIMS.forEach(function(d){o[d.k]=src.snap[d.k];});return o;})(),
                pains:["该节点来自真实复盘，困扰清单由贡献者填写"],
                tasks:src.tasks.map(function(x,i){
                  return {id:"u"+p.vid+"t"+i,type:x.type,title:x.title,
                    src:"用户贡献节点 · 已通过 "+NEED+" 位同处境用户校验",
                    pre:"与贡献者处境相近",risk:"前置条件可能不同，需自行核对",std:"由你自行设定"};
                })
              });
            }
            A.refreshAll();
            flash("y-peer-flash","已达到 "+NEED+" 个有效标记，该复盘升级为公共节点，已进入知识网络。");
          }else{
            flash("y-peer-flash","已记录 1 个有效标记（"+p.marks+"/"+NEED+"）。单条反馈不直接改变公共知识。");
          }
          renderPool();
        });
        row.appendChild(btn); card.appendChild(row);
      }
      box.appendChild(card);
    });
  }

  function renderPeers(){
    var box=Q("y-peer-review"); if(!box) return;
    box.textContent="";
    PEERS.forEach(function(p){
      var card=document.createElement("div"); card.className="y-pool";
      var top=document.createElement("div"); top.className="y-vic-top";
      var t=document.createElement("strong"); t.style.fontSize="12.5px"; t.textContent=p.who;
      var c=document.createElement("span");
      c.className="y-chip "+(p.kind==="亲历记述"?"y-chip-c":
        (p.kind==="行业共识"?"y-chip-b":"y-chip-w"));
      c.textContent=p.kind;
      top.appendChild(t); top.appendChild(c); card.appendChild(top);
      var b=document.createElement("p"); b.className="y-vic-body"; b.textContent=p.text;
      card.appendChild(b);
      var m=document.createElement("p"); m.className="y-vic-ts"; m.style.marginTop="5px";
      m.textContent=p.marks+" 位处境相近的用户标记有用";
      card.appendChild(m);
      box.appendChild(card);
    });
  }

  /* ---- 闭环状态提示 ---- */
  function renderLoopState(){
    var el=Q("y-loop-state"); if(!el) return;
    var n=A.ST.victories.length;
    var doing=A.ST.tasks.filter(function(t){return t.status==="doing";}).length;
    var ready=archivable().length;
    var cur=A.current();
    if(!A.ST.tasks.length){
      el.textContent="当前处于「"+cur.node.name.split(" · ")[0]+"」域。闭环从领取任务开始："+
        "到工作台载入本域参考任务，或自己新增一条。";
    }else if(ready){
      el.textContent="有 "+ready+" 段体验已标记完成，可以去驿站停靠了。"+
        "停靠会归档为阶段性胜利，并让你的位置发生小幅漂移。";
    }else if(doing){
      el.textContent="工作台有 "+doing+" 项进行中。完成后在任务上标记「已完成」，再到驿站停靠。"+
        (n?"已累计 "+n+" 次阶段性胜利。":"");
    }else{
      el.textContent="已累计 "+n+" 次阶段性胜利。可以回到第 2 步地图看看落点变化，"+
        "或在工作台领取新一轮任务。";
    }
  }

  function renderAll(){
    renderTasks(); renderStopCtx(); renderStopList(); renderDrift();
    renderWall(); renderCompare(); renderPool(); renderPeers(); renderLoopState();
  }

  /* ---- 子页签 ---- */
  var SUBS=[["y-t1","y-m1"],["y-t2","y-m2"],["y-t3","y-m3"],["y-t4","y-m4"]];
  function showSub(n){
    A.ST.sub=n;
    SUBS.forEach(function(p,i){
      var tab=Q(p[0]), panel=Q(p[1]);
      var on=(i+1)===n;
      if(tab) tab.setAttribute("aria-selected",on?"true":"false");
      if(panel) panel.hidden=!on;
    });
    if(n===1) renderTasks();
    if(n===2){ renderStopCtx(); renderStopList(); renderDrift(); }
    if(n===3){ renderWall(); renderCompare(); }
    if(n===4){ renderPool(); renderPeers(); }
  }
  SUBS.forEach(function(p,i){
    var tab=Q(p[0]); if(!tab) return;
    tab.addEventListener("click",function(){ showSub(i+1); });
    tab.addEventListener("keydown",function(ev){
      var j=-1;
      if(ev.key==="ArrowRight") j=(i+1)%SUBS.length;
      else if(ev.key==="ArrowLeft") j=(i-1+SUBS.length)%SUBS.length;
      else if(ev.key==="Home") j=0;
      else if(ev.key==="End") j=SUBS.length-1;
      if(j<0) return;
      ev.preventDefault(); showSub(j+1);
      var nx=Q(SUBS[j][0]); if(nx) nx.focus();
    });
  });

  /* ---- 事件绑定 ---- */
  Q("y-load-tasks").addEventListener("click",function(){
    var node=A.current().node;
    var added=loadTasks(node);
    renderTasks(); renderStopList(); renderDrift(); renderLoopState();
    flash("y-load-flash", added
      ? "已把「"+node.name.split(" · ")[0]+"」的 "+added+" 条参考任务载入工作台。这是草稿，增删改都在你手上。"
      : "该域的任务已经全部在工作台里了。");
  });
  Q("y-filter").addEventListener("change",function(){
    A.ST.filter=Q("y-filter").value; renderTasks();
  });
  Q("y-add-open").addEventListener("click",function(){
    var f=Q("y-add-form");
    f.hidden=!f.hidden;
    if(!f.hidden) Q("y-add-title").focus();
  });
  Q("y-add-cancel").addEventListener("click",function(){
    Q("y-add-form").hidden=true;
    Q("y-add-title").value=""; Q("y-add-err").textContent="";
  });
  function submitTask(){
    var title=(Q("y-add-title").value||"").trim();
    if(title.length<4){
      Q("y-add-err").textContent="请把任务写清楚一些（至少 4 个字），已输入的内容不会丢失。";
      Q("y-add-title").focus();
      return;
    }
    Q("y-add-err").textContent="";
    A.ST.seq+=1;
    A.ST.tasks.push({id:"k"+A.ST.seq,src:"custom-"+A.ST.seq,node:"custom",nodeName:"自定义",
      type:Q("y-add-type").value,title:title,
      origin:"由你自己添加",pre:"由你自行设定",risk:"—",std:"由你自行设定",
      status:"doing",custom:true,archived:false});
    Q("y-add-title").value="";
    Q("y-add-form").hidden=true;
    var hidden=A.ST.filter!=="all"&&A.ST.filter!=="doing";
    renderTasks(); renderStopList(); renderDrift(); renderLoopState();
    flash("y-bench-flash", hidden
      ? "已加入清单（进行中），但当前筛选条件下不显示。"
      : "已加入清单。自定义任务与系统草稿在系统里权重相同。");
  }
  Q("y-add-submit").addEventListener("click",submitTask);
  Q("y-add-title").addEventListener("keydown",function(ev){
    if(ev.key==="Enter"){ ev.preventDefault(); submitTask(); }
  });
  R.querySelectorAll('input[name="y-next"]').forEach(function(rb){
    rb.addEventListener("change",renderDrift);
  });
  Q("y-archive").addEventListener("click",archive);
  Q("y-cmp-a").addEventListener("change",renderCompare);
  Q("y-cmp-b").addEventListener("change",renderCompare);

  /* 暴露给主脚本：进入第 6 步时整体刷新 */
  A.renderLoop=function(){ renderAll(); showSub(A.ST.sub||1); };
  A.resetLoop=function(){
    A.ST.tasks=[]; A.ST.victories=[]; A.ST.pool=[];
    A.ST.loadedNode=null; A.ST.filter="all"; A.ST.sub=1;
    var sel=Q("y-filter"); if(sel) sel.value="all";
    ["y-q1","y-q2","y-q3"].forEach(function(id){ var el=Q(id); if(el) el.value=""; });
    var keep=R.querySelector('input[name="y-next"][value="keep"]');
    if(keep) keep.checked=true;
    renderAll();
  };
  renderAll();
})();
