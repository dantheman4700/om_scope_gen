-- Seed the Offering Memorandum template with variables
-- This creates the default template for generating M&A offering memoranda

-- Insert the Offering Memorandum template
INSERT INTO document_templates (id, name, description, template_content, output_formats, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Offering Memorandum',
  'A comprehensive document for M&A transactions that presents the investment opportunity to potential buyers.',
  E'# Executive Summary

{{executive_summary}}

## Company Overview

### Company Name
{{company_name}}

### Business Description
{{business_description}}

### Products and Services
{{product_services}}

## Market Opportunity

{{market_opportunity}}

## Competitive Position

### Competitive Advantages
{{competitive_advantages}}

### Market Position
{{market_position}}

## Financial Overview

### Financial Highlights
{{financial_highlights}}

### Historical Performance
{{historical_performance}}

### Growth Trajectory
{{growth_trajectory}}

## Management Team

{{team_overview}}

## Investment Highlights

{{investment_highlights}}

## Transaction Overview

### Asking Price
{{asking_price}}

### Transaction Structure
{{transaction_structure}}

## Risk Factors

{{risk_factors}}

## Contact Information

For inquiries regarding this opportunity, please contact the transaction advisor.

---

*This Confidential Information Memorandum has been prepared solely for informational purposes. The information contained herein is confidential and proprietary.*',
  ARRAY['pdf', 'docx'],
  true
) ON CONFLICT (name) DO NOTHING;

-- Insert template variables with RAG questions
INSERT INTO template_variables (template_id, variable_name, display_name, description, rag_question, fallback_value, variable_type, required, sort_order)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'company_name', 'Company Name', 'The name of the company being sold', 'What is the name of the company?', 'The Company', 'text', true, 1),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'executive_summary', 'Executive Summary', 'A high-level overview of the investment opportunity', 'Provide a comprehensive executive summary of this business opportunity. Include key highlights about the company, its market position, financial performance, and why it represents an attractive investment.', 'Information not available.', 'rich_text', true, 2),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'business_description', 'Business Description', 'Detailed description of what the company does', 'Describe the company''s business model, operations, and how it generates revenue. What does the company do and how does it operate?', 'Information not available.', 'rich_text', true, 3),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'product_services', 'Products and Services', 'Description of products and services offered', 'What products and services does the company offer? Describe the main offerings, their features, and value proposition to customers.', 'Information not available.', 'rich_text', true, 4),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'market_opportunity', 'Market Opportunity', 'The market size and growth potential', 'Describe the market opportunity. What is the total addressable market size? What are the growth trends and drivers in this market?', 'Information not available.', 'rich_text', true, 5),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'competitive_advantages', 'Competitive Advantages', 'What makes this company unique', 'What are the company''s key competitive advantages and differentiators? What makes them stand out from competitors?', 'Information not available.', 'rich_text', true, 6),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'market_position', 'Market Position', 'The company''s position in the market', 'What is the company''s market position? Who are the main competitors and how does the company compare?', 'Information not available.', 'rich_text', false, 7),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'financial_highlights', 'Financial Highlights', 'Key financial metrics and performance', 'What are the key financial metrics and highlights? Include revenue, EBITDA, margins, and other important financial indicators.', 'Financial details available upon request.', 'rich_text', true, 8),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'historical_performance', 'Historical Performance', 'Past financial performance', 'Describe the company''s historical financial performance. What have been the revenue and profit trends over recent years?', 'Information not available.', 'rich_text', false, 9),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'growth_trajectory', 'Growth Trajectory', 'Future growth potential', 'What is the company''s growth trajectory? Describe historical growth rates and future growth opportunities.', 'Information not available.', 'rich_text', false, 10),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'team_overview', 'Team Overview', 'Management team information', 'Who are the key members of the management team and what are their backgrounds? Describe the leadership team and their relevant experience.', 'Management details available upon request.', 'rich_text', true, 11),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'investment_highlights', 'Investment Highlights', 'Key reasons to invest', 'What are the key investment highlights? List the main reasons why this represents an attractive investment opportunity.', 'Information not available.', 'rich_text', true, 12),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'asking_price', 'Asking Price', 'The price being asked for the company', 'What is the asking price or valuation for this company?', 'Price available upon request.', 'text', false, 13),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'transaction_structure', 'Transaction Structure', 'How the deal is structured', 'What is the proposed transaction structure? Is this an asset sale, stock sale, merger, or other structure?', 'Transaction structure to be discussed with qualified buyers.', 'rich_text', false, 14),
  
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'risk_factors', 'Risk Factors', 'Key risks to consider', 'What are the key risk factors that potential buyers should be aware of? Include operational, market, financial, and other relevant risks.', 'Risk factors to be discussed during due diligence.', 'rich_text', false, 15)
ON CONFLICT DO NOTHING;

