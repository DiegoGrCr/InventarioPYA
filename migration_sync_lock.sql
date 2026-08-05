-- Traba simple para evitar que dos ejecuciones del sync de Google Sheets
-- corran al mismo tiempo (ej. si el disparador externo reintenta, o si
-- Vercel invoca la función más de una vez casi al mismo tiempo). Sin esto,
-- dos corridas simultáneas pueden leer/escribir la misma hoja en momentos
-- distintos y generar reconstrucciones de pestañas innecesarias en bucle.

CREATE TABLE sync_lock (
  id INTEGER PRIMARY KEY,
  locked_at TIMESTAMPTZ
);

INSERT INTO sync_lock (id, locked_at) VALUES (1, NULL);

ALTER TABLE sync_lock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on sync_lock" ON sync_lock FOR ALL USING (true) WITH CHECK (true);
