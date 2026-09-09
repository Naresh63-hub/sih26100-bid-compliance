-- BIDGUARD AI: Supabase Storage RLS Policies
-- Enables authenticated users (officers) to manage documents in tender, bidder, and report buckets

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Tender Documents Bucket Policies
CREATE POLICY "Authenticated users can upload tender documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tender-documents');

CREATE POLICY "Authenticated users can read tender documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tender-documents');

CREATE POLICY "Authenticated users can update tender documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tender-documents');

CREATE POLICY "Authenticated users can delete tender documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tender-documents');

-- 2. Bidder Documents Bucket Policies
CREATE POLICY "Authenticated users can upload bidder documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bidder-documents');

CREATE POLICY "Authenticated users can read bidder documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bidder-documents');

CREATE POLICY "Authenticated users can update bidder documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bidder-documents');

CREATE POLICY "Authenticated users can delete bidder documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bidder-documents');

-- 3. Generated Reports Bucket Policies
CREATE POLICY "Authenticated users can upload generated reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-reports');

CREATE POLICY "Authenticated users can read generated reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-reports');

CREATE POLICY "Authenticated users can delete generated reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-reports');
