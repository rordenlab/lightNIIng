export type Project = {
  slug: string
  title: string
  summary: string
  tags: string[]
}

export type Tool = {
  name: string
  href: string
  blurb: string
}

export type SiteConfig = {
  title: string
  tagline: string
  intro: string
  siteUrl: string
  appUrl: string
  releasesUrl: string
  defaultAccent: string
  projects: Project[]
  tools: Tool[]
}

const config: SiteConfig = {
  title: "lightNIIng",
  tagline:
    "High-performance processing built on truly open software—unencumbered by commercial usage restrictions or code contamination risks.",
  intro:
    "Permissively open infrastructure that simplifies deployment and accelerates proven neuroimaging methods.",
  siteUrl: "https://lightniing.org",
  appUrl: "https://github.com/rordenlab/lightNIIng",
  releasesUrl: "https://github.com/rordenlab/lightNIIng",
  defaultAccent: "garnet",
  projects: [
    {
      slug: "spatial_processing",
      title: "Spatial Processing",
      summary:
        "Fast, portable voxel-based image registration for normalization and motion correction.",
      tags: ["Registration", "Realignment", "3dvolreg", "3dAllineate"],
    },
    {
      slug: "temporal_processing",
      title: "Temporal Processing",
      summary: "High-performance voxel-based motion correction and detrending.",
      tags: ["Slice Timing", "Detrending", "3dTshift"],
    },
    {
      slug: "spatial_unwarping",
      title: "Spatial Unwarping",
      summary:
        "Echo planar images are inherently spatially distorted. However, phase images can be used to correct the shape of multi-echo BOLD fMRI data.",
      tags: ["Multi-echo", "MEDIC", "ROMEO"],
    },
    {
      slug: "brain_extraction",
      title: "Brain Extraction",
      summary:
        "Accurate removal of scalp signals improves image processing. The AI-based mindgrab is a fast but robust method that works with any modality.",
      tags: ["mindgrab", "brainchop", "AI"],
    },
    {
      slug: "diffusion_imaging",
      title: "Diffusion Imaging",
      summary:
        "Our team has accelerated popular tools for processing diffusion imaging to improve tractography.",
      tags: ["WebGPU", "Metal", "streamlines"],
    },
  ],
  tools: [
    {
      name: "niimath",
      href: "https://github.com/rordenlab/niimath",
      blurb: "Compact, high-performance image maths with broad NIfTI support.",
    },
    {
      name: "dcm2niix",
      href: "https://github.com/rordenlab/dcm2niix",
      blurb: "The widely used converter from DICOM to NIfTI and BIDS sidecars.",
    },
    {
      name: "NiiVue",
      href: "https://niivue.com/",
      blurb: "Fast, dependency-light neuroimaging visualization for the web.",
    },
    {
      name: "mindgrab",
      href: "https://github.com/rordenlab/mindgrab",
      blurb: "Lightweight brain extraction for practical imaging workflows.",
    },
    {
      name: "BIDSvue",
      href: "https://github.com/niivue/BIDSvue",
      blurb: "Desktop curation, de-identification, validation, and sharing for BIDS.",
    },
    {
      name: "GPUStreamlines",
      href: "https://github.com/dipy/GPUStreamlines/",
      blurb: "GPU-accelerated streamline generation across CUDA, Metal, and WebGPU.",
    },
  ],
}

export default config
