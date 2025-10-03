async function q(id){ return document.getElementById(id); }

async function loadProjects(){
  const tbody = document.querySelector('#projectsTable tbody');
  tbody.innerHTML = '';
  try{
    const res = await fetch('/api/projects');
    if(!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    (data.projects||[]).forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.folder||''}</td><td>${p.name||''}</td><td>${p.file}</td><td><button data-file="${p.file}" class="del">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button.del').forEach(b=> b.addEventListener('click', async (e)=>{
      const file = e.currentTarget.dataset.file;
      if(!confirm('Delete '+file+' ?')) return;
      const resp = await fetch('/api/delete', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file }) });
      const j = await resp.json();
      if(resp.ok) { loadProjects(); alert(j.message || 'Deleted'); } else { alert(j.error || 'Failed'); }
    }));
  }catch(e){
    tbody.innerHTML = '<tr><td colspan="4">Error loading projects</td></tr>';
  }
}

loadProjects();
