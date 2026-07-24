# CultureCoin Operator Automation Patch V19

Adds smart onboarding, account doctor, install wizard, risk profile, trade results, support tickets, admin health, setup progress, and next-action dashboard cards.

## New Pages
- /member/home
- /member/onboarding
- /member/account-doctor
- /member/mt4-webrequest-guide
- /member/install/:botSlug
- /member/risk-profile
- /member/trade-results
- /member/support/tickets
- /admin/health

## New APIs
- GET /api/me/accounts
- GET /api/me/risk-profile
- POST /api/me/risk-profile
- POST /api/support/tickets

## Goal
Guide users through Join → Login → Connect MT4 → Buy Bot → Install Bot → Run Bot → Share Results → Copy/Signal → Commission.
