import { listings } from "@/lib/api";

export const updateChipFoundryListing = async () => {
  const listingId = "57cd2671-3ec9-4e81-b5a6-2b97b373041a";
  
  const updateData = {
    companyName: 'Efabless Corporation',
    companyWebsite: 'https://www.chipfoundry.io',
    title: 'Efabless Corporation - Semiconductor Design Platform & Complete IP Assets',
    description: `Efabless Corporation offers a transformative acquisition opportunity in the semiconductor design space. Founded in 2014, Efabless pioneered a design-to-tapeout platform that democratizes chip development, making custom silicon accessible to a global community of 13,000+ designers from 50+ countries who have completed 1,500+ designs and 600+ tapeouts.

The company addresses the historically high cost and complexity of semiconductor development through its chipIgnite platform - a turnkey design-to-silicon flow featuring pre-built SoC "harness" chips (Caravel variants), cloud-hosted automated verification, and a marketplace for IP blocks, PDKs, and EDA tools. By reducing first silicon costs from $2-3M to under $10K (100x reduction) and aggregating up to 40 designs in a single shuttle, Efabless opens custom silicon development to applications previously too niche or low-volume to justify traditional ASIC development.

Currently supporting the SkyWater 130nm node, the platform has enabled over 40 product companies across 9 countries to develop chips for keyboard controllers (100K+ units), IoT controllers (300K+ units), PLC systems, medical sensors, DSPs, RFID systems, and air quality monitoring. The edge AI chip market opportunity alone is valued at $16B (2023) with 33.9% CAGR through 2030, targeting 10B+ units/year in ultra-low-power applications.

Now in Assignment for Benefit of Creditors (ABC) as of April 7, 2025, following an unsuccessful Series B financing, this represents a strategic acquisition of proven technology, a large engaged community, and comprehensive IP assets positioned at the intersection of open-source innovation and commercial semiconductor development.`,
    
    industry: 'Semiconductor Design & Manufacturing',
    location: 'Santa Clara, California',
    trademarks: ['chipIgnite (US Application No. 98/817,224, filed 10/23/24, pending)'],
    patentCount: 15,
    
    dataBreakdown: {
      intellectual_property: {
        patents: '15 issued patents (3 pending) covering essential chip design elements including obfuscation for proprietary IP/PDK access, design request systems for community engagement, and configurable reference designs for semi-custom chips',
        trademarks: 'chipIgnite trademark (US Application No. 98/817,224, pending)',
        brand: 'Efabless brand and domain name rights'
      },
      software_platforms: {
        ef_platform: 'Proprietary AWS-hosted web system providing end-to-end semiconductor project management, including file uploads, design precheck, verification, automated tapeout submission, user-facing marketplace for IP/EDA tools, and role-based profile management',
        private_repositories: 'Collection of unreleased tools, IP, and in-development design assets including machine learning models and support utilities',
        ip_qualification_framework: 'Structured system for qualifying, tracking, and managing IP contributions for marketplace commercialization',
        drc_deck_regression_suite: 'Test infrastructure for validating DRC deck changes with proprietary validation IP and tooling'
      },
      advanced_architectures: {
        frigate_cheetah: 'Next-generation high-performance, low-power Caravel platform with analog subsystems. Taped out on CI-2409 and CI-2411 shuttles',
        soc_22nm: 'Completed planning, market modeling, and technical architecture for 22nm node SoC developed with industry partners',
        ml_accelerator: 'Silicon-validated NNoM Q7 machine learning accelerator IP block for embedded use, taped out and pending packaging/testing',
        swift_arm: 'ARM Cortex-M0 Caravel variant created in collaboration with ARM for educational and startup applications',
        generative_ai_flow: 'Investigative work and proof of concept for generative AI chip design flow'
      },
      physical_inventory: {
        silicon_lots: 'CI-2409 and CI-2411 production material from September and November 2024 shuttles, available in bare die or final packaged state',
        dev_boards: 'Prebuilt Caravel development boards, assembled and tested for customer delivery or resale'
      },
      documentation: {
        technical_docs: 'Complete set of design tutorials, usage documentation, and training videos',
        educational_content: 'Training materials hosted on YouTube and internal channels'
      },
      commercial_assets: {
        customer_database: '13,000+ registered designers from 50+ countries',
        academic_institutions: '50+ institutions using chipIgnite program at price points from $300 to $9,750 per design',
        product_companies: '40+ product companies across 9 countries in production or development',
        community: '8,000+ registered forum users, 5,000+ public profiles, active design challenges'
      },
      open_source_components: {
        caravel_framework: 'System-on-Chip design template under Apache 2.0 license, publicly available',
        openlane_toolchain: 'Complete EDA toolchain with design templates and community tooling on GitHub'
      },
      proven_applications: [
        'Keyboard controllers (100K+ units confirmed production)',
        'IoT controllers (300K+ units in pipeline)',
        'PLC systems (100K+ units confirmed)',
        'Digital signal processors (10K units planned)',
        'Medical sensors (qualified)',
        'RFID systems (10K units qualified)',
        'Air quality monitoring sensors',
        'Edge ML applications (10B+ units/year total addressable market)'
      ],
      target_markets: [
        'Smart Homes & Buildings - Predictive maintenance, smart thermostats, intrusion/smoke detection, elder care',
        'Industrial & Manufacturing - In-line defect detection, asset tracking, predictive maintenance',
        'Agriculture - Precision irrigation, livestock monitoring',
        'Environment & Infrastructure - Pollution/wildfire detection, bridge/structural monitoring',
        'Retail & Logistics - In-store analytics, real-time inventory management',
        'Personal Wellness & Medical - Fitness tracking, fall detection, biometric sensors',
        'Education - 50+ academic institutions, pricing $300-$9,750 per design'
      ]
    },
    
    meta: {
      keyAssets: {
        brand: 'Efabless brand and chipIgnite trademark (US Application No. 98/817,224, pending)',
        domain: 'efabless.com, chipfoundry.com, and 18+ other domains',
        codebase: 'EF Platform (AWS-hosted proprietary web system), OpenLane toolchain, private repositories with unreleased tools and IP, IP qualification framework, DRC deck regression test suite, ML models',
        website: 'Platform website with marketplace for IP blocks, PDKs, EDA tools, design services. User-facing marketplace with role-based profile management',
        customerList: 'Database of 13,000+ registered designers from 50+ countries, 40+ product companies across 9 countries, 50+ academic institutions',
        socialMedia: 'Community forums with 8,000+ registered users, 5,000+ public profiles, engagement through design challenges and shared projects',
        emailList: 'Database of 13,000+ designers across academic and commercial segments',
        revenueStreams: 'chipIgnite design-to-silicon services ($300-$9,750 per design), marketplace revenue sharing on IP/EDA tools, education programs for 50+ institutions, revenue-sharing model with IP vendors',
        documentation: 'Complete technical documentation, design tutorials, training videos (YouTube and internal), usage documentation for EF Platform and chipIgnite flow',
        inventory: 'CI-2409 and CI-2411 silicon lots (production material), prebuilt Caravel development boards, Frigate/Cheetah chips (taped out), ML Accelerator (silicon-validated)',
        selected: ['brand', 'ip', 'codebase', 'emailList', 'website', 'revenueStreams', 'customerList', 'domain', 'socialMedia', 'documentation', 'inventory']
      },
      offering_memorandum_summary: {
        organization: 'At wind-down: 23 full-time employees, majority in USA with design center in Egypt. Executive team: CEO, CTO, COO, CBO, SVP New Product Development',
        competitive_advantages: [
          'Cost: 100x reduction vs traditional ASICs ($2-3M to under $10K)',
          'Power: 10x lower power vs MCUs/FPGAs/CPUs',
          'Complexity: Expands designer pool from 200K experts to 20M+ software/hardware engineers',
          'Time: Pre-built SoC platforms eliminate 3-6 month licensing delays',
          'Integration: Analog and digital integration for lower BOM',
          'Security: Enhanced security through custom silicon'
        ],
        market_data: {
          custom_silicon_market: '$20B+ global market',
          edge_ai_market: '$16B in 2023, 33.9% CAGR through 2030',
          addressable_opportunity: '$200B+ as 70% of AI inference moves to custom silicon (McKinsey)',
          education_shortage: '67,000 U.S. chip designers shortage projected by 2030 (SIA)'
        },
        status: 'Assignment for Benefit of Creditors (ABC) as of April 7, 2025. Assignee: Efabless (assignment for the benefit of creditors), LLC, affiliate of Sherwood Partners, Inc.',
        sale_terms: 'Asset sale on "as-is, where-is" basis with limited representations/warranties. Letter of Intent deadline: August 15, 2025',
        strategic_positioning: 'Pioneering position at intersection of open-source innovation and commercial semiconductor development. First open-source PDK collaboration with Google and SkyWater Technology. Founding member of RISC-V International.'
      }
    }
  };

  try {
    const { listing } = await listings.update(listingId, updateData);
    return { data: listing, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
