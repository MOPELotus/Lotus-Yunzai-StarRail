import { expect, test } from "bun:test";
import { makePanelListCards, readTheme } from "../panel-card.ts";
import type { PanelAvatar, PanelSnapshot } from "../panel-model.ts";

test("panel list keeps more than 48 characters together for updates and ordinary reads", async () => {
 const theme=await readTheme();
 const avatar:PanelAvatar={id:"1001",name:"三月七",element:"冰",path:"存护",face:"",splash:"",skills:[],traces:[],stars:[],stats:[],relics:[],rank:0,level:80};
 const signal=new AbortController().signal;
 for(const count of [0,1,48,49,81])for(const updated of [false,true]){
  const snapshot:PanelSnapshot={version:1,uid:"100000042",source:"miyoushe",avatars:Array.from({length:count},()=>avatar)};
  const models=await makePanelListCards(snapshot,theme,1,signal,updated,true);
  expect(models.length).toBe(count?1:0);
  if(count){expect(models[0]?.chars.length).toBe(count);expect(models[0]?.hasNew).toBe(updated);}
 }
});
