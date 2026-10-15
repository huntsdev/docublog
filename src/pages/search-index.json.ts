import { getCollection } from 'astro:content';
import { getPosts, getProjects, tagSlug } from '../lib/content';

export async function GET() {
  const [posts, projects, about] = await Promise.all([getPosts(), getProjects(), getCollection('about')]);
  const clean = (body = '') => body.replace(/<[^>]+>/g, ' ').replace(/!?(\[([^\]]+)\])\([^)]*\)/g, '$2').replace(/[#*`_>]/g, '').replace(/\s+/g, ' ').trim();
  const entries = [
    ...posts.map(post => ({id:`blog-${post.id}`,title:post.data.title,description:post.data.description,author:post.data.author,body:clean(post.body),tags:post.data.tags,section:'Blog Posts',url:`/blog/${post.id}/`,breadcrumb:`Blog Posts > ${post.data.title}`})),
    ...projects.map(project => ({id:`project-${project.id}`,title:project.data.title,description:project.data.description,author:project.data.author,body:clean(project.body),tags:[],section:'Projects',url:`/projects/${project.id}/`,breadcrumb:`Projects > ${project.data.title}`})),
    ...about.map(page => ({id:`about-${page.id}`,title:page.data.title,description:page.data.description,author:page.data.author,body:clean(page.body),tags:[],section:'About',url:'/about/',breadcrumb:`About > ${page.data.title}`})),
    ...[...new Set(posts.flatMap(p => p.data.tags))].map(tag => ({id:`tag-${tagSlug(tag)}`,title:tag,description:`Read blog posts about ${tag}.`,body:tag,tags:[tag],section:'Blog Posts',url:`/blog/tags/${tagSlug(tag)}/`,breadcrumb:`Blog Posts > Topics > ${tag}`})),
    {id:'overview',title:'Overview',description:'The hunts.dev personal knowledge base.',body:'Engineering, security, projects and technical notes.',tags:[],section:'Explore',url:'/',breadcrumb:'Explore > Overview'},
    {id:'blog',title:'All blog posts',description:'Browse and filter all blog posts by topic.',body:'Writing guides field notes',tags:[],section:'Blog Posts',url:'/blog/',breadcrumb:'Blog Posts > All posts'},
    {id:'projects',title:'All projects',description:'Browse tools, experiments, and project notebooks.',body:'Projects workbench source code',tags:[],section:'Projects',url:'/projects/',breadcrumb:'Projects > All projects'},
  ];
  return Response.json(entries);
}
