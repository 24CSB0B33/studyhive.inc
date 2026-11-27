const groups = {
  'Science & Mathematics': 'Mathematics, Algebra, Geometry, Calculus, Statistics, Probability, Number Theory, Physics, Chemistry, Organic Chemistry, Biology, Genetics, Ecology, Astronomy, Earth Science, Climate Science',
  'Computing & Technology': 'Computer Science, Programming, Python, JavaScript, Java, C++, Rust, Data Structures, Algorithms, Operating Systems, Databases, Networking, Cybersecurity, Artificial Intelligence, Machine Learning, Data Science, Cloud Computing, Web Development, Mobile Development, Game Development, Robotics, Blockchain, UX Design',
  'Engineering': 'Mechanical Engineering, Electrical Engineering, Electronics, Civil Engineering, Chemical Engineering, Aerospace Engineering, Biomedical Engineering, Renewable Energy, Telecommunications',
  'Business & Economics': 'Economics, Microeconomics, Macroeconomics, Finance, Accounting, Investing, Marketing, Entrepreneurship, Management, Business Analytics, Supply Chain, Project Management',
  'Humanities & Social Sciences': 'History, Indian History, World History, Philosophy, Psychology, Sociology, Political Science, Anthropology, Geography, International Relations, Law, Public Policy, Linguistics',
  'Languages & Literature': 'English Literature, Creative Writing, Hindi, Sanskrit, Tamil, Telugu, Bengali, Marathi, French, Spanish, German, Japanese, Korean, Arabic, Translation',
  'Arts & Media': 'Fine Arts, Drawing, Music Theory, Photography, Film Studies, Journalism, Architecture, Theatre, Graphic Design, Animation',
  'Health & Life': 'Medicine, Anatomy, Public Health, Nursing, Nutrition, Neuroscience, Mental Health, Pharmacology, Physiotherapy',
  'Exams & Professional': 'UPSC, Civil Services, GATE, JEE, NEET, CAT, GRE, GMAT, IELTS, TOEFL, CA Foundation, CFA, Bar Exam, Teaching Certification'
};
export const topicGroups = Object.fromEntries(Object.entries(groups).map(([category, text]) => [category, text.split(', ')]));
export const allTopics = Object.values(topicGroups).flat();
