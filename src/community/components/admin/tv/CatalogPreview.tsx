import {useEffect,useRef,useState} from 'react';
import {BoardElements} from '@/tv/BoardElements';
import type {BoardElement} from '@/tv/elements';
/** Render the actual layers only when their thumbnail approaches the viewport. */
export function CatalogPreview({elements}:{elements:BoardElement[]}){
 const ref=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'200px'});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
 return <div ref={ref} className="relative aspect-video w-full overflow-hidden bg-slate-100" style={{containerType:'size'}}>{visible&&<BoardElements elements={elements}/>}</div>;
}
