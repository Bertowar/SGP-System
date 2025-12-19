-- Rename 'Manutenção Elétrica' to 'Man. Elétrica'
UPDATE downtime_types 
SET description = 'Man. Elétrica' 
WHERE description = 'Manutenção Elétrica';

-- Rename 'Manutenção Mecânica' to 'Man. Mecânica'
UPDATE downtime_types 
SET description = 'Man. Mecânica' 
WHERE description = 'Manutenção Mecânica';
