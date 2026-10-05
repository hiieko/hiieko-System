-- Restore only indexes justified by current query paths.
-- Aviz detail -> items uses aviz_id; inventory lists filter by project_id and order by created_at.
CREATE INDEX "aviz_items_aviz_id_idx" ON "aviz_items"("aviz_id");
CREATE INDEX "stock_balances_project_id_idx" ON "stock_balances"("project_id");
CREATE INDEX "stock_movements_project_id_created_at_idx" ON "stock_movements"("project_id", "created_at");
