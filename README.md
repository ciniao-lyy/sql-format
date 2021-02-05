change languige mode:sql or *sql

exsample:

select  field1 
       ,field2 
       ,case when c1 = 'c1' then 1
             when c1 = 'c2' then 2
             else 0
         end field3 
       ,sum(field4) field4
  from  dual
 where  condition1 = 'a1'
   and  condition2 = 'a2'
 group  by  field1 
       ,field2 
       ,case when c1 = 'c1' then 1
             when c1 = 'c2' then 2
             else 0
         end