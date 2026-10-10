-- Se ejecuta una sola vez, cuando el contenedor crea la base de datos.
-- btree_gist permite las restricciones de exclusión que impiden
-- que dos clases o reservas ocupen el mismo laboratorio a la misma hora.
-- Las migraciones de Django también la crean; esto es un respaldo.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- También en template1, para que la base de datos de pruebas la herede.
\c template1
CREATE EXTENSION IF NOT EXISTS btree_gist;
