do $$
declare mill uuid; press uuid; closed_machine uuid; jo uuid; lee uuid;
begin
 if exists(select 1 from scheduling.resources where code='DEMO-MILL') then return;end if;
 insert into scheduling.resources(code,name,kind,hold,evidence,review_due) values('DEMO-MILL','Demo milling cell','machine',false,'Fictional inspection MILL-7',current_date+20) returning id into mill;
 insert into scheduling.resources(code,name,kind,hold,evidence,review_due) values('DEMO-PRESS','Demo press cell','machine',false,'Fictional inspection PRESS-4',current_date+20) returning id into press;
 insert into scheduling.resources(code,name,kind,hold,evidence,review_due) values('DEMO-HOLD','Demo isolated lathe','machine',true,'Fictional failed guard check',current_date-3) returning id into closed_machine;
 insert into scheduling.resources(code,name,kind,hold,evidence,review_due) values('DEMO-JO','Jo, fictional operator','operator',false,'Fictional competence matrix',current_date+90) returning id into jo;
 insert into scheduling.resources(code,name,kind,hold,evidence,review_due) values('DEMO-LEE','Lee, fictional operator','operator',false,'Fictional competence matrix',current_date+90) returning id into lee;
 insert into scheduling.operations(code,order_code,sequence,machine_id,operator_id,setup_minutes,run_minutes,ready_at,due_at,material_ready,note) values
 ('FRAME-10','FRAME',10,mill,jo,30,540,current_date+time '08:00',current_date+time '12:00',true,'Rush frame order'),
 ('FRAME-20','FRAME',20,press,lee,20,180,current_date+time '08:00',current_date+time '16:00',true,'Press after milling'),
 ('BRACKET-10','BRACKET',10,mill,jo,15,120,current_date+time '08:00',current_date-1+time '16:00',true,'Overdue bracket batch'),
 ('PIN-10','PIN',10,closed_machine,lee,20,60,current_date+time '08:00',current_date+1+time '16:00',true,'Must not use isolated lathe'),
 ('COVER-10','COVER',10,press,lee,15,90,current_date+time '08:00',current_date+1+time '16:00',false,'Awaiting sheet stock');
 insert into scheduling.closures(resource_id,closed_on,reason) values(press,current_date+1,'Fictional planned maintenance');
end $$;
