-- ============================================================
-- SKILLUPNOW — SEED DATA
-- Run AFTER schema.sql
-- NOTE: auth.users rows must be created via Supabase Auth API
--       (Dashboard → Authentication → Users → "Add user").
--       Replace the UUIDs below with the real IDs you get back.
-- ============================================================

-- ============================================================
-- STEP 1: Create these users in Supabase Auth Dashboard first,
--         then paste their UUIDs here.
-- ============================================================

-- Placeholder UUIDs (replace with real ones from Auth dashboard)
-- Super Admin  : 00000000-0000-0000-0000-000000000001
-- Regular User1: 00000000-0000-0000-0000-000000000002
-- Regular User2: 00000000-0000-0000-0000-000000000003

-- ============================================================
-- ADMIN SETUP
-- ============================================================
INSERT INTO public.admin_users (user_id, role, permissions, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'super_admin',
  '{
    "users":    {"view":true,"edit":true,"delete":true},
    "courses":  {"view":true,"edit":true,"delete":true},
    "payments": {"view":true,"edit":true,"delete":true},
    "reports":  {"view":true,"export":true},
    "settings": {"view":true,"edit":true}
  }',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================
-- SAMPLE COURSES
-- ============================================================
INSERT INTO public.courses
  (name, slug, level, category, short_description, description, key_topics, learning_outcomes, career_opportunities, price, discounted_price,
   duration_hours, duration_months, instructor_name, is_emi_available, min_emi_months, max_emi_months,
   is_active, is_featured, tools, prerequisites, syllabus)
VALUES

-- 1. Full Stack Web Development
(
  'Full Stack Web Development',
  'full-stack-web-development',
  'beginner',
  'Web Development',
  'Build modern web apps with HTML, CSS, JavaScript, React and Node.js.',
  'A comprehensive hands-on program covering frontend and backend development. You will build real-world projects and deploy them to the cloud.',
  ARRAY['HTML5 & CSS3','JavaScript ES6+','React.js','Node.js','Express','MongoDB','REST APIs','Git & GitHub'],
  ARRAY['Build responsive web applications','Create RESTful APIs','Deploy applications to cloud','Work with databases','Implement authentication','Version control with Git'],
  ARRAY['Full Stack Developer','Frontend Developer','Backend Developer','Web Application Developer','Freelance Developer','Startup Tech Lead'],
  35000.00, 29999.00,
  240, 6,
  'Arjun Mehta',
  TRUE, 3, 12,
  TRUE, TRUE,
  ARRAY['VS Code','React','Node.js','MongoDB','Git','Docker'],
  ARRAY['Basic computer skills','Logical thinking'],
  '[
    {"week":1,"topic":"HTML & CSS Foundations","subtopics":["Semantic HTML","Flexbox","Grid","Responsive Design"]},
    {"week":2,"topic":"JavaScript Core","subtopics":["ES6+","DOM manipulation","Fetch API","Async/Await"]},
    {"week":3,"topic":"React.js","subtopics":["Components","Hooks","Context","React Router"]},
    {"week":4,"topic":"Node.js & Express","subtopics":["REST APIs","Middleware","Authentication","JWT"]},
    {"week":5,"topic":"Databases","subtopics":["MongoDB","PostgreSQL","Supabase"]},
    {"week":6,"topic":"Deployment","subtopics":["Git","Docker basics","Vercel","AWS S3"]}
  ]'::jsonb
),

-- 2. AWS Cloud Practitioner
(
  'AWS Cloud Practitioner',
  'aws-cloud-practitioner',
  'beginner',
  'Cloud',
  'Prepare for the AWS CCP certification with hands-on labs.',
  'Covers all AWS Cloud Practitioner exam domains: cloud concepts, security, technology, and billing. Includes practice exams.',
  ARRAY['Cloud Computing','AWS Global Infrastructure','Core AWS Services','Security Best Practices','Cost Management','AWS Well-Architected Framework'],
  ARRAY['Understand cloud computing fundamentals','Navigate AWS services','Implement security best practices','Optimize cloud costs','Prepare for AWS certification'],
  ARRAY['Cloud Engineer','AWS Solutions Architect','Cloud Consultant','DevOps Engineer','Cloud Security Specialist','Infrastructure Engineer'],
  25000.00, 19999.00,
  120, 3,
  'Priya Sharma',
  TRUE, 3, 6,
  TRUE, TRUE,
  ARRAY['AWS Console','AWS CLI','CloudFormation'],
  ARRAY['Basic IT knowledge'],
  '[
    {"week":1,"topic":"Cloud Concepts","subtopics":["What is cloud","AWS Global Infrastructure","Shared Responsibility"]},
    {"week":2,"topic":"Core Services","subtopics":["EC2","S3","RDS","VPC","IAM"]},
    {"week":3,"topic":"Security & Compliance","subtopics":["IAM Policies","CloudTrail","Shield","WAF"]}
  ]'::jsonb
),

-- 3. Data Science with Python
(
  'Data Science with Python',
  'data-science-python',
  'intermediate',
  'Data Science',
  'Master data analysis, visualisation, and machine learning with Python.',
  'From Pandas and NumPy to Scikit-Learn and deep learning basics. Build a portfolio of data projects.',
  ARRAY['Python Programming','Data Analysis','Machine Learning','Data Visualization','Statistics','SQL','Jupyter Notebooks'],
  ARRAY['Analyze complex datasets','Build machine learning models','Create compelling visualizations','Apply statistical methods','Work with SQL databases','Present data insights'],
  ARRAY['Data Scientist','Data Analyst','Machine Learning Engineer','Business Intelligence Analyst','Data Engineer','Research Analyst'],
  45000.00, 39999.00,
  300, 6,
  'Kavitha Rajan',
  TRUE, 3, 12,
  TRUE, FALSE,
  ARRAY['Python','Jupyter','Pandas','Scikit-Learn','Matplotlib','TensorFlow'],
  ARRAY['Basic Python','High school maths'],
  '[
    {"week":1,"topic":"Python Foundations","subtopics":["NumPy","Pandas","Data Cleaning"]},
    {"week":2,"topic":"Visualisation","subtopics":["Matplotlib","Seaborn","Plotly"]},
    {"week":3,"topic":"Statistics","subtopics":["Descriptive stats","Probability","Hypothesis testing"]},
    {"week":4,"topic":"Machine Learning","subtopics":["Regression","Classification","Clustering","Model evaluation"]},
    {"week":5,"topic":"Deep Learning","subtopics":["Neural Networks","Keras","CNN basics"]},
    {"week":6,"topic":"Projects","subtopics":["EDA project","Prediction model","Dashboard"]}
  ]'::jsonb
),

-- 4. Ethical Hacking & Cyber Security
(
  'Ethical Hacking & Cyber Security',
  'ethical-hacking-cyber-security',
  'intermediate',
  'Cyber Security',
  'Learn penetration testing, vulnerability assessment, and network security.',
  'Hands-on course covering OWASP Top 10, network scanning, exploitation, and security hardening. CEH exam aligned.',
  ARRAY['Penetration Testing','Network Security','Web Application Security','Vulnerability Assessment','Ethical Hacking','OWASP Top 10','Cryptography'],
  ARRAY['Conduct security assessments','Identify vulnerabilities','Perform penetration testing','Implement security controls','Understand attack vectors','Use security tools'],
  ARRAY['Ethical Hacker','Cyber Security Analyst','Penetration Tester','Security Consultant','SOC Analyst','Security Engineer'],
  40000.00, 34999.00,
  200, 5,
  'Rajan Kumar',
  TRUE, 3, 10,
  TRUE, FALSE,
  ARRAY['Kali Linux','Nmap','Metasploit','Wireshark','Burp Suite'],
  ARRAY['Networking basics','Linux fundamentals'],
  '[
    {"week":1,"topic":"Foundations","subtopics":["CIA Triad","Threat landscape","Legal & ethics"]},
    {"week":2,"topic":"Networking Security","subtopics":["TCP/IP","Scanning","Sniffing"]},
    {"week":3,"topic":"Web App Attacks","subtopics":["OWASP Top 10","SQL Injection","XSS","CSRF"]},
    {"week":4,"topic":"Exploitation","subtopics":["Metasploit","Buffer overflow","Privilege escalation"]},
    {"week":5,"topic":"Defence","subtopics":["Hardening","IDS/IPS","SIEM","Incident response"]}
  ]'::jsonb
),

-- 5. DevOps & CI/CD
(
  'DevOps & CI/CD',
  'devops-cicd',
  'advanced',
  'DevOps',
  'Master Docker, Kubernetes, Jenkins, and infrastructure-as-code.',
  'Enterprise-grade DevOps practices. Automate build, test, and deployment pipelines. Deploy to AWS EKS.',
  ARRAY['Docker','Kubernetes','CI/CD Pipelines','Infrastructure as Code','Container Orchestration','Monitoring','Cloud Platforms','Automation'],
  ARRAY['Deploy containerized applications','Automate deployment pipelines','Manage Kubernetes clusters','Implement infrastructure as code','Monitor system performance','Use DevOps tools'],
  ARRAY['DevOps Engineer','Site Reliability Engineer','Cloud Architect','Platform Engineer','Infrastructure Engineer','Release Manager'],
  55000.00, 49999.00,
  320, 6,
  'Suresh Pillai',
  TRUE, 6, 12,
  TRUE, FALSE,
  ARRAY['Docker','Kubernetes','Jenkins','Terraform','Ansible','GitHub Actions'],
  ARRAY['Linux administration','Basic scripting'],
  '[
    {"week":1,"topic":"Linux & Shell","subtopics":["Bash scripting","Systemd","Logging"]},
    {"week":2,"topic":"Containers","subtopics":["Docker","Docker Compose","Container security"]},
    {"week":3,"topic":"Kubernetes","subtopics":["Pods","Deployments","Services","Helm"]},
    {"week":4,"topic":"CI/CD","subtopics":["Jenkins","GitHub Actions","ArgoCD"]},
    {"week":5,"topic":"IaC","subtopics":["Terraform","Ansible","CloudFormation"]},
    {"week":6,"topic":"Monitoring","subtopics":["Prometheus","Grafana","ELK Stack"]}
  ]'::jsonb
);


-- ============================================================
-- SAMPLE USER PROFILES
-- (user_profiles are auto-created on auth signup via trigger;
--  manually insert here only if testing without the trigger)
-- ============================================================
INSERT INTO public.user_profiles
  (id, full_name, email, phone, city, state, is_email_verified, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'Amit Verma',    'amit.verma@example.com',  '9876543210', 'Chennai',   'Tamil Nadu', TRUE,  TRUE),
  ('00000000-0000-0000-0000-000000000003', 'Sneha Nair',    'sneha.nair@example.com',  '9988776655', 'Bangalore', 'Karnataka',  TRUE,  TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SAMPLE ENROLLMENTS
-- ============================================================
DO $$
DECLARE
  course_fullstack UUID;
  course_aws       UUID;
  enroll1          UUID;
  enroll2          UUID;
BEGIN
  SELECT id INTO course_fullstack FROM public.courses WHERE slug = 'full-stack-web-development';
  SELECT id INTO course_aws       FROM public.courses WHERE slug = 'aws-cloud-practitioner';

  -- Amit: full payment for Full Stack
  INSERT INTO public.enrollments
    (id, user_id, course_id, payment_type, payment_status, total_amount, paid_amount, progress_percentage, status)
  VALUES
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002',
     course_fullstack, 'full', 'completed', 29999.00, 29999.00, 45, 'active')
  RETURNING id INTO enroll1;

  -- Sneha: EMI for AWS course (3 months)
  INSERT INTO public.enrollments
    (id, user_id, course_id, payment_type, payment_status, total_amount, paid_amount, emi_months, progress_percentage, status)
  VALUES
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000003',
     course_aws, 'emi', 'partial', 19999.00, 6667.00, 3, 15, 'active')
  RETURNING id INTO enroll2;

  -- Generate EMI schedule for Sneha's enrollment
  PERFORM public.generate_emi_schedule(enroll2);
END;
$$;


-- ============================================================
-- SAMPLE PAYMENTS
-- ============================================================
INSERT INTO public.payments
  (user_id, enrollment_id, amount, payment_method, status, description)
SELECT
  e.user_id,
  e.id,
  e.paid_amount,
  'upi',
  'completed',
  'Initial payment for ' || c.name
FROM   public.enrollments e
JOIN   public.courses c ON c.id = e.course_id
WHERE  e.payment_status = 'completed';


-- ============================================================
-- SAMPLE FEEDBACK
-- ============================================================
INSERT INTO public.feedback
  (user_id, course_id, rating, title, feedback_text, is_approved, is_featured)
SELECT
  e.user_id,
  e.course_id,
  5,
  'Excellent course!',
  'The curriculum is very practical and the instructor explained concepts clearly. Highly recommended for anyone starting out.',
  TRUE,
  TRUE
FROM public.enrollments e
WHERE e.user_id = '00000000-0000-0000-0000-000000000002'
ON CONFLICT (user_id, course_id) DO NOTHING;


-- ============================================================
-- SAMPLE INQUIRY
-- ============================================================
INSERT INTO public.inquiries
  (user_id, name, email, phone, subject, inquiry_details, inquiry_type, status, source)
VALUES
  (NULL, 'Rahul Gupta', 'rahul.gupta@example.com', '9123456789',
   'Course fee query',
   'Hello, I am interested in the Full Stack Web Development course. Could you please share the detailed fee structure and EMI options available?',
   'course', 'open', 'website'),
  ('00000000-0000-0000-0000-000000000003',
   'Sneha Nair', 'sneha.nair@example.com', '9988776655',
   'EMI due date change',
   'I would like to request a change in my EMI due date from the 1st to the 15th of each month due to my salary cycle.',
   'payment', 'open', 'website');


-- ============================================================
-- SEED COMPLETE
-- ============================================================
