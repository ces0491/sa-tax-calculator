# SA Tax Calculator

A comprehensive, dynamic South African tax calculator built with Next.js and React. Features real-time SARS tax bracket calculations, provisional tax planning, and professional export capabilities for tax practitioners.

![SA Tax Calculator](https://img.shields.io/badge/Tax-Calculator-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![React](https://img.shields.io/badge/React-18-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)

## ✨ Features

- 🎯 **Auto Tax Year Detection** - Automatically detects current SA tax year
- 📊 **Real SARS Tax Brackets** - Uses current SARS tax brackets with automatic updates
- ✏️ **Manual Entry & Editing** - Full CRUD operations for income and expenses
- 🏠 **Home Office Calculator** - Proportional home office expense calculations
- 📈 **Real-time Calculations** - Live tax calculations as you input data
- 📄 **Professional Exports** - CSV and formatted reports for tax practitioners
- 🔄 **Data Source Tracking** - Track auto-detected vs manual entries
- 💾 **Import/Export** - Bulk import from CSV files
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎨 **Modern UI** - Clean, professional interface with Tailwind CSS

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy Button (Fastest)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USERNAME/sa-tax-calculator)

### Option 2: Manual Deployment

#### Prerequisites
- Node.js 18.0.0 or later
- Git
- GitHub account
- Vercel account (free)

#### Step 1: Clone and Setup
```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/sa-tax-calculator.git
cd sa-tax-calculator

# Install dependencies
npm install

# Test locally
npm run dev
```

#### Step 2: Create GitHub Repository
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: SA Tax Calculator"

# Create repository on GitHub and push
git remote add origin https://github.com/YOUR-USERNAME/sa-tax-calculator.git
git branch -M main
git push -u origin main
```

#### Step 3: Deploy to Vercel
1. **Sign up/Login to Vercel** at [vercel.com](https://vercel.com)
2. **Import Project**:
   - Click "New Project"
   - Import from your GitHub repository
   - Select `sa-tax-calculator`
3. **Configure Project**:
   - Framework Preset: **Next.js**
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
4. **Deploy**: Click "Deploy"

Your app will be live at: `https://sa-tax-calculator-YOUR-USERNAME.vercel.app`

## 🛠️ Local Development

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run export       # Export static files
```

### Environment Variables (Optional)
Create `.env.local`:
```env
NEXT_PUBLIC_APP_NAME="SA Tax Calculator"
NEXT_PUBLIC_VERSION="1.0.0"
```

## 📊 Usage Guide

### 1. **Tax Year Selection**
- App auto-detects current SA tax year (March-February cycle)
- Select different tax years from dropdown
- Tax brackets update automatically

### 2. **Income Management**
- **Auto-detected**: Entries from bank statement analysis
- **Manual**: Click "Add Income" to add custom entries
- **Edit**: Enable edit mode to modify any entry
- **Categories**: Employment, Freelance, Investment, etc.

### 3. **Expense Management**
- **Business Expenses**: Tax-deductible expenses
- **Personal Expenses**: Non-deductible (for review)
- **Move Between**: Transfer expenses between categories
- **Home Office**: Automatic proportional calculations

### 4. **Data Import/Export**
- **Import CSV**: Bulk import from spreadsheets
- **Export CSV**: Detailed data export
- **Tax Summary**: Professional report for practitioners

### 5. **Tax Calculations**
- Real-time provisional tax calculations
- Effective vs marginal tax rates
- Monthly tax requirements
- After-tax income projections

## 🎨 Customization

### Themes
The app uses Tailwind CSS with CSS variables for theming. Customize colors in `src/app/globals.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%;        /* Blue theme */
  --secondary: 210 40% 96%;            /* Light gray */
  --accent: 210 40% 96%;               /* Accent color */
}
```

### Tax Brackets
Update tax brackets in `src/data/taxBrackets.js` or the component directly. The app supports multiple tax years with historical data.

### Branding
- Replace logo in `public/logo.png`
- Update app name in `src/app/layout.js`
- Modify colors in `tailwind.config.js`

## 🔧 Configuration

### Vercel Configuration
The app includes `vercel.json` for optimal deployment:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### Custom Domain (Optional)
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### Analytics (Optional)
Add Vercel Analytics:
```bash
npm install @vercel/analytics
```

Then in `src/app/layout.js`:
```javascript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## 📱 PWA Support

The app includes basic PWA support with `manifest.json`. To enhance:

1. Add service worker in `public/sw.js`
2. Register in `src/app/layout.js`
3. Enable offline functionality

## 🔒 Security & Privacy

- All calculations performed client-side
- No data sent to external servers
- Local storage for user preferences only
- No personal financial data stored remotely

## 🐛 Troubleshooting

### Common Issues

**Build Errors:**
```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

**Styling Issues:**
```bash
# Rebuild Tailwind
npx tailwindcss build -i ./src/app/globals.css -o ./dist/output.css
```

**Deployment Fails:**
- Check Node.js version (18.0.0+)
- Verify all dependencies in `package.json`
- Check build logs in Vercel dashboard

### Performance Optimization

1. **Image Optimization**: Use Next.js `Image` component
2. **Code Splitting**: Lazy load components
3. **Bundle Analysis**: Run `npm run build` and check output

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Receipt scanning
- [ ] Database for profile specific data storage

## 📊 Tax Compliance Notice

This calculator provides estimates based on SARS tax brackets. Always consult with a qualified tax practitioner for official tax advice and filing.

---

### Technologies Used
- [Next.js 14](https://nextjs.org/) - React framework
- [React 18](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide React](https://lucide.dev/) - Icons
- [Vercel](https://vercel.com/) - Deployment platform

### Last Updated
Tax brackets and rebates current as of SARS 2026 tax year announcement.