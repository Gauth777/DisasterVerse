export function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k.startsWith("on") && typeof v === "function"){ node.addEventListener(k.slice(2).toLowerCase(), v); }
    else if(k==="class"){ node.className = v; }
    else node.setAttribute(k, v);
  });
  for(const c of children) node.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return node;
}

export function progressBar(value, max){
  const wrap = el("div",{class:"progress"});
  const fill = el("div");
  fill.style.width = `${Math.max(0, Math.min(100, (value/max)*100))}%`;
  wrap.append(fill);
  return wrap;
}
