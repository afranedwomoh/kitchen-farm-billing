
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_invoice_item() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;

-- Storage policies: allow authenticated to read/write these buckets
CREATE POLICY "auth_read_product_images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "auth_write_product_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth_update_product_images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "auth_delete_product_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "auth_read_business_assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-assets');
CREATE POLICY "auth_write_business_assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth_update_business_assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-assets' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth_delete_business_assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-assets' AND public.has_role(auth.uid(),'admin'));
