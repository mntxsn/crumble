# Crumble — Privacy Policy

**Effective Date:** 2026-05-26

## Purpose

Crumble automatically hides or dismisses cookie consent banners on websites, with the goal of improving your browsing experience without compromising your privacy.

## Data collection

We value your privacy and collect as little data as possible.

- **Normal usage**
  During normal operation Crumble does **not** collect, store, or share any personal or identifiable information. All processing happens locally inside your browser.

- **"Report" feature**
  When you choose to submit a report through the popup, Crumble sends only the following minimal, non-personal data to the reporting endpoint:
  - The **hostname** of the website you reported
  - The **browser used** (e.g. Chrome, Firefox)
  - The **version of the extension**
  - Any **notes you voluntarily add** to the report

  No IP addresses, browsing history, or personal identifiers are collected or stored.

  > **Note**: while Crumble is in early standalone release the reporting endpoint may be temporarily routed through the upstream `I still don't care about cookies` API or hosted by the Crumble maintainer. This will be updated here transparently. If you want zero report data leaving your machine, use the "GitHub" reporting path instead — it just opens a pre-filled issue form in your browser.

## Data storage

Reports submitted through the "Report" feature may be published as GitHub issues in the public Crumble repository. Anything you include in your notes becomes publicly visible once published.

If you'd like a report or part of it removed or redacted, contact the maintainer (details below). Crumble maintainers will make a reasonable effort to delete or anonymise relevant data.

We do not sell, share, or otherwise disclose reported information to third parties for marketing, analytics, or unrelated purposes.

## Permissions

The browser permissions Crumble requests are used solely for the extension's intended functionality (hiding cookie banners, applying network-level blocking rules). These permissions do **not** grant access to personal data or browsing activity beyond what's necessary for that purpose.

## Third-party access

Crumble does **not** include analytics, tracking scripts, advertising services, or any other third-party integrations. The optional "Sync" feature uses the browser's own sync service (Firefox Sync or Chrome Sync) — no third-party endpoint.

## Data security

We take reasonable measures to protect any data submitted through the "Report" feature from unauthorised access or disclosure.

## Children's privacy

Crumble does not knowingly collect or store data relating to minors.

## Changes to this policy

This policy may be updated to reflect improvements or regulatory requirements. Updates will be posted in the repository and on store listings.

## Contact

- **GitHub**: <https://github.com/mntxsn/crumble/issues>
- For privacy-specific inquiries, open an issue prefixed with `[privacy]` or contact the maintainer directly via the email listed on the GitHub profile.
