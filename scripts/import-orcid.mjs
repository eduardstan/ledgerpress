#!/usr/bin/env node
// =============================================================================
// import-orcid.mjs - fetch public ORCID record and print YAML fragments for cv.yaml
//
// Usage: node scripts/import-orcid.mjs <orcid-id>
// =============================================================================

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const YAML = require(require.resolve("yaml", { paths: ["./web", "."] }));

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(monthVal) {
  if (!monthVal) return null;
  const num = parseInt(monthVal, 10);
  if (isNaN(num) || num < 1 || num > 12) return null;
  return MONTH_NAMES[num - 1];
}

function formatDate(dateObj) {
  if (!dateObj || !dateObj.year || !dateObj.year.value) return null;
  const year = dateObj.year.value.trim();
  if (!year) return null;
  const month = formatMonth(dateObj.month?.value);
  return month ? `${month} ${year}` : year;
}

function formatDates(startDateObj, endDateObj) {
  const startStr = formatDate(startDateObj);
  const endStr = formatDate(endDateObj);

  if (endDateObj === null) {
    // Ongoing / no end date specified
    if (startStr) {
      return `${startStr} – Present`;
    }
    return null;
  }

  if (endStr) {
    if (startStr) {
      if (startStr === endStr) return startStr;
      return `${startStr} – ${endStr}`;
    }
    return endStr;
  }

  if (startStr) {
    return `${startStr} – Present`;
  }

  return null;
}

function formatPlace(address) {
  if (!address) return undefined;
  const city = address.city?.trim();
  let region = address.region?.trim();
  let country = address.country?.trim();

  if (region && (region.toLowerCase() === "region" || region.toLowerCase() === "n/a" || (city && region.toLowerCase() === city.toLowerCase()))) {
    region = undefined;
  }

  if (country && country.length === 2) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      const fullname = displayNames.of(country.toUpperCase());
      if (fullname) country = fullname;
    } catch {
      // keep 2-letter code if Intl fails
    }
  }

  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function extractSortKeys(summary) {
  const startDate = summary["start-date"];
  const endDate = summary["end-date"];

  const endYear = endDate?.year?.value ? parseInt(endDate.year.value, 10) : endDate === null ? 9999 : 0;
  const endMonth = endDate?.month?.value ? parseInt(endDate.month.value, 10) : 12;

  const startYear = startDate?.year?.value ? parseInt(startDate.year.value, 10) : 0;
  const startMonth = startDate?.month?.value ? parseInt(startDate.month.value, 10) : 0;

  return { endYear, endMonth, startYear, startMonth };
}

function sortSummaries(summaries) {
  return [...summaries].sort((a, b) => {
    const keyA = extractSortKeys(a);
    const keyB = extractSortKeys(b);

    if (keyA.endYear !== keyB.endYear) return keyB.endYear - keyA.endYear;
    if (keyA.endMonth !== keyB.endMonth) return keyB.endMonth - keyA.endMonth;
    if (keyA.startYear !== keyB.startYear) return keyB.startYear - keyA.startYear;
    if (keyA.startMonth !== keyB.startMonth) return keyB.startMonth - keyA.startMonth;

    const titleA = a["role-title"] || "";
    const titleB = b["role-title"] || "";
    if (titleA !== titleB) return titleA.localeCompare(titleB);

    const orgA = a.organization?.name || "";
    const orgB = b.organization?.name || "";
    if (orgA !== orgB) return orgA.localeCompare(orgB);

    return (b["put-code"] || 0) - (a["put-code"] || 0);
  });
}

function mapSummaryToEntry(summary) {
  const roleTitle = summary["role-title"]?.trim();
  const orgName = summary.organization?.name?.trim();
  const placeStr = formatPlace(summary.organization?.address);
  const datesStr = formatDates(summary["start-date"], summary["end-date"]);
  const deptName = summary["department-name"]?.trim();
  const urlVal = summary.url?.value?.trim();

  const entry = {};
  let missingTitle = false;

  if (roleTitle) {
    entry.title = roleTitle;
  } else {
    missingTitle = true;
  }

  if (orgName) entry.org = orgName;
  if (placeStr) entry.place = placeStr;
  if (datesStr) entry.dates = datesStr;
  if (deptName) entry.detail = deptName;
  if (urlVal) entry.url = urlVal;

  return { entry, missingTitle };
}

export function parseOrcidRecord(data) {
  const act = data["activities-summary"] || {};

  function extractSummariesFromGroup(groupObj, key) {
    if (!groupObj || !Array.isArray(groupObj["affiliation-group"])) return [];
    const res = [];
    for (const grp of groupObj["affiliation-group"]) {
      for (const s of grp.summaries || []) {
        if (s[key]) res.push(s[key]);
      }
    }
    return res;
  }

  const rawEmployments = extractSummariesFromGroup(act.employments, "employment-summary");
  const rawEducations = extractSummariesFromGroup(act.educations, "education-summary");
  const rawQualifications = extractSummariesFromGroup(act.qualifications, "qualification-summary");

  const sortedEmployments = sortSummaries(rawEmployments);
  const sortedEducationsAndQualifications = sortSummaries([...rawEducations, ...rawQualifications]);

  const appointmentsList = sortedEmployments.map(mapSummaryToEntry);
  const educationList = sortedEducationsAndQualifications.map(mapSummaryToEntry);

  return { appointments: appointmentsList, education: educationList };
}

export function formatOrcidYaml(parsedData) {
  const docObj = {};

  if (parsedData.appointments.length === 0) {
    docObj.appointments = [];
  } else {
    docObj.appointments = parsedData.appointments.map((item) => item.entry);
  }

  if (parsedData.education.length === 0) {
    docObj.education = [];
  } else {
    docObj.education = parsedData.education.map((item) => item.entry);
  }

  const doc = new YAML.Document(docObj);

  parsedData.appointments.forEach((item, index) => {
    if (item.missingTitle) {
      const node = doc.getIn(["appointments", index], true);
      if (node) {
        node.commentBefore = " title: missing in ORCID record - complete by hand";
      }
    }
  });

  parsedData.education.forEach((item, index) => {
    if (item.missingTitle) {
      const node = doc.getIn(["education", index], true);
      if (node) {
        node.commentBefore = " title: missing in ORCID record - complete by hand";
      }
    }
  });

  return doc.toString();
}

export function extractOrcidId(arg) {
  if (!arg) return null;
  const match = arg.match(/\d{4}-\d{4}-\d{4}-[\dX]{4}/i);
  return match ? match[0] : null;
}

export async function fetchAndFormatOrcid(orcidInput) {
  const orcidId = extractOrcidId(orcidInput);
  if (!orcidId) {
    throw new Error(`Invalid ORCID iD format: ${orcidInput}`);
  }

  const url = `https://pub.orcid.org/v3.0/${orcidId}/record`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ORCID record for ${orcidId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const parsed = parseOrcidRecord(data);
  return formatOrcidYaml(parsed);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/import-orcid.mjs <orcid-id>");
    process.exit(1);
  }

  try {
    const yamlOutput = await fetchAndFormatOrcid(arg);
    process.stdout.write(yamlOutput);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
